import * as path from 'path';
import { EventEmitter } from 'events';
import PgMigrate, { RunnerOption } from 'node-pg-migrate';
import { Pool, PoolClient, ClientConfig, Client, ClientBase, QueryResult } from 'pg';

import {
  parsePort,
  APP_DIR,
  isTestEnv,
  isDevEnv,
  bufferToHexPrefixString,
  hexToBuffer,
  stopwatch,
  timeout,
  logger,
  logError,
} from '../helpers';
import {
  DataStore,
  DbBlock,
  DbTx,
  DbStxEvent,
  DbFtEvent,
  DbNftEvent,
  DbTxTypeId,
  DbSmartContractEvent,
  DbSmartContract,
  DbEvent,
  DbFaucetRequest,
  DataStoreEventEmitter,
  DbEventTypeId,
  DataStoreUpdateData,
  DbFaucetRequestCurrency,
} from './common';
import { TransactionType } from '@blockstack/stacks-blockchain-sidecar-types';
import { getTxTypeId } from '../api/controllers/db-controller';

const MIGRATIONS_TABLE = 'pgmigrations';
const MIGRATIONS_DIR = path.join(APP_DIR, 'migrations');

export function getPgClientConfig(): ClientConfig {
  const config: ClientConfig = {
    database: process.env['PG_DATABASE'],
    user: process.env['PG_USER'],
    password: process.env['PG_PASSWORD'],
    host: process.env['PG_HOST'],
    port: parsePort(process.env['PG_PORT']),
  };
  return config;
}

export async function runMigrations(
  clientConfig: ClientConfig = getPgClientConfig(),
  direction: 'up' | 'down' = 'up'
): Promise<void> {
  if (direction !== 'up' && !isTestEnv && !isDevEnv) {
    throw new Error(
      'Whoa there! This is a testing function that will drop all data from PG. ' +
        'Set NODE_ENV to "test" or "development" to enable migration testing.'
    );
  }
  clientConfig = clientConfig ?? getPgClientConfig();
  const client = new Client(clientConfig);
  try {
    await client.connect();
    const runnerOpts: RunnerOption = {
      dbClient: client,
      dir: MIGRATIONS_DIR,
      direction: direction,
      migrationsTable: MIGRATIONS_TABLE,
      count: Infinity,
      logger: {
        info: msg => {},
        warn: msg => logger.warn(msg),
        error: msg => logger.error(msg),
      },
    };
    if (process.env['PG_SCHEMA']) {
      runnerOpts.schema = process.env['PG_SCHEMA'];
    }
    await PgMigrate(runnerOpts);
  } catch (error) {
    logError(`Error running pg-migrate`, error);
    throw error;
  } finally {
    await client.end();
  }
}

export async function cycleMigrations(): Promise<void> {
  const clientConfig = getPgClientConfig();

  await runMigrations(clientConfig, 'down');
  await runMigrations(clientConfig, 'up');
}

const TX_COLUMNS = `
  -- required columns
  tx_id, tx_index, index_block_hash, block_hash, block_height, burn_block_time, type_id, status, 
  canonical, post_conditions, fee_rate, sponsored, sender_address, origin_hash_mode,

  -- token-transfer tx columns
  token_transfer_recipient_address, token_transfer_amount, token_transfer_memo,

  -- smart-contract tx columns
  smart_contract_contract_id, smart_contract_source_code,

  -- contract-call tx columns
  contract_call_contract_id, contract_call_function_name, contract_call_function_args,

  -- poison-microblock tx columns
  poison_microblock_header_1, poison_microblock_header_2,

  -- coinbase tx columns
  coinbase_payload
`;

const BLOCK_COLUMNS = `
  block_hash, index_block_hash, parent_index_block_hash, parent_block_hash, parent_microblock, block_height, burn_block_time, canonical
`;

interface BlockQueryResult {
  block_hash: Buffer;
  index_block_hash: Buffer;
  parent_index_block_hash: Buffer;
  parent_block_hash: Buffer;
  parent_microblock: Buffer;
  block_height: number;
  burn_block_time: number;
  canonical: boolean;
}

interface TxQueryResult {
  tx_id: Buffer;
  tx_index: number;
  index_block_hash: Buffer;
  block_hash: Buffer;
  block_height: number;
  burn_block_time: number;
  type_id: number;
  status: number;
  canonical: boolean;
  post_conditions: Buffer;
  fee_rate: string;
  sponsored: boolean;
  sender_address: string;
  origin_hash_mode: number;

  // `token_transfer` tx types
  token_transfer_recipient_address?: string;
  token_transfer_amount?: string;
  token_transfer_memo?: Buffer;

  // `smart_contract` tx types
  smart_contract_contract_id?: string;
  smart_contract_source_code?: string;

  // `contract_call` tx types
  contract_call_contract_id?: string;
  contract_call_function_name?: string;
  contract_call_function_args?: Buffer;

  // `poison_microblock` tx types
  poison_microblock_header_1?: Buffer;
  poison_microblock_header_2?: Buffer;

  // `coinbase` tx types
  coinbase_payload?: Buffer;
}

interface FaucetRequestQueryResult {
  currency: string;
  ip: string;
  address: string;
  occurred_at: string;
}

interface UpdatedEntities {
  blocks: number;
  txs: number;
  stxEvents: number;
  ftEvents: number;
  nftEvents: number;
  contractLogs: number;
  smartContracts: number;
}

export class PgDataStore extends (EventEmitter as { new (): DataStoreEventEmitter })
  implements DataStore {
  readonly pool: Pool;
  private constructor(pool: Pool) {
    // eslint-disable-next-line constructor-super
    super();
    this.pool = pool;
  }

  async getChainTipHeight(
    client: ClientBase
  ): Promise<{ blockHeight: number; blockHash: string; indexBlockHash: string }> {
    const currentTipBlock = await client.query<{
      block_height: number;
      block_hash: Buffer;
      index_block_hash: Buffer;
    }>(
      `
      SELECT block_height, block_hash, index_block_hash
      FROM blocks
      WHERE canonical = true AND block_height = (SELECT MAX(block_height) FROM blocks)
      `
    );
    const height = currentTipBlock.rows[0]?.block_height ?? 0;
    return {
      blockHeight: height,
      blockHash: bufferToHexPrefixString(currentTipBlock.rows[0]?.block_hash ?? Buffer.from([])),
      indexBlockHash: bufferToHexPrefixString(
        currentTipBlock.rows[0]?.index_block_hash ?? Buffer.from([])
      ),
    };
  }

  async update(data: DataStoreUpdateData): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const chainTip = await this.getChainTipHeight(client);
      await this.handleReorg(client, data.block, chainTip.blockHeight);
      // If the incoming block is not of greater height than current chain tip, then store data as non-canonical.
      if (data.block.block_height <= chainTip.blockHeight) {
        data.block.canonical = false;
        data.txs.forEach(tx => {
          tx.tx.canonical = false;
          tx.stxEvents.forEach(e => (e.canonical = false));
          tx.ftEvents.forEach(e => (e.canonical = false));
          tx.nftEvents.forEach(e => (e.canonical = false));
          tx.contractLogEvents.map(e => (e.canonical = false));
          tx.smartContracts.map(e => (e.canonical = false));
        });
      }
      const blocksUpdated = await this.updateBlock(client, data.block);
      if (blocksUpdated !== 0) {
        for (const entry of data.txs) {
          await this.updateTx(client, entry.tx);
          for (const stxEvent of entry.stxEvents) {
            await this.updateStxEvent(client, entry.tx, stxEvent);
          }
          for (const ftEvent of entry.ftEvents) {
            await this.updateFtEvent(client, entry.tx, ftEvent);
          }
          for (const nftEvent of entry.nftEvents) {
            await this.updateNftEvent(client, entry.tx, nftEvent);
          }
          for (const contractLog of entry.contractLogEvents) {
            await this.updateSmartContractEvent(client, entry.tx, contractLog);
          }
          for (const smartContract of entry.smartContracts) {
            await this.updateSmartContract(client, entry.tx, smartContract);
          }
        }
      }
      await client.query('COMMIT');
      this.emit('blockUpdate', data.block);
      data.txs.forEach(entry => {
        this.emit('txUpdate', entry.tx);
      });
    } catch (error) {
      logError(`Error performing PG update: ${error}`, error);
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async markEntitiesCanonical(
    client: ClientBase,
    indexBlockHash: Buffer,
    canonical: boolean,
    updatedEntities: UpdatedEntities
  ): Promise<void> {
    const txResult = await client.query(
      `
      UPDATE txs
      SET canonical = $2
      WHERE index_block_hash = $1 AND canonical != $2
      `,
      [indexBlockHash, canonical]
    );
    updatedEntities.txs += txResult.rowCount;

    const stxResults = await client.query(
      `
      UPDATE stx_events
      SET canonical = $2
      WHERE index_block_hash = $1 AND canonical != $2
      `,
      [indexBlockHash, canonical]
    );
    updatedEntities.stxEvents += stxResults.rowCount;

    const ftResult = await client.query(
      `
      UPDATE ft_events
      SET canonical = $2
      WHERE index_block_hash = $1 AND canonical != $2
      `,
      [indexBlockHash, canonical]
    );
    updatedEntities.ftEvents += ftResult.rowCount;

    const nftResult = await client.query(
      `
      UPDATE nft_events
      SET canonical = $2
      WHERE index_block_hash = $1 AND canonical != $2
      `,
      [indexBlockHash, canonical]
    );
    updatedEntities.nftEvents += nftResult.rowCount;

    const contractLogResult = await client.query(
      `
      UPDATE contract_logs
      SET canonical = $2
      WHERE index_block_hash = $1 AND canonical != $2
      `,
      [indexBlockHash, canonical]
    );
    updatedEntities.contractLogs += contractLogResult.rowCount;

    const smartContractResult = await client.query(
      `
      UPDATE smart_contracts
      SET canonical = $2
      WHERE index_block_hash = $1 AND canonical != $2
      `,
      [indexBlockHash, canonical]
    );
    updatedEntities.smartContracts += smartContractResult.rowCount;
  }

  async restoreOrphanedChain(
    client: ClientBase,
    indexBlockHash: Buffer,
    updatedEntities: UpdatedEntities
  ): Promise<UpdatedEntities> {
    const blockResult = await client.query<{
      parent_index_block_hash: Buffer;
      block_height: number;
    }>(
      `
      -- restore the previously orphaned block to canonical
      UPDATE blocks
      SET canonical = true
      WHERE index_block_hash = $1 AND canonical = false
      RETURNING parent_index_block_hash, block_hash, block_height
      `,
      [indexBlockHash]
    );

    if (blockResult.rowCount === 0) {
      throw new Error(
        `could not find orphaned block by index_hash ${indexBlockHash.toString('hex')}`
      );
    }
    if (blockResult.rowCount > 1) {
      throw new Error(
        `found multiple non-canonical parents for index_hash ${indexBlockHash.toString('hex')}`
      );
    }

    const orphanedBlockResult = await client.query<{ index_block_hash: Buffer }>(
      `
      -- orphan the now conflicting block at the same height
      UPDATE blocks
      SET canonical = false
      WHERE block_height = $1 AND index_block_hash != $2 AND canonical = true
      RETURNING index_block_hash
      `,
      [blockResult.rows[0].block_height, indexBlockHash]
    );
    if (orphanedBlockResult.rowCount > 0) {
      await this.markEntitiesCanonical(
        client,
        orphanedBlockResult.rows[0].index_block_hash,
        false,
        updatedEntities
      );
    }

    await this.markEntitiesCanonical(client, indexBlockHash, true, updatedEntities);

    const parentResult = await client.query<{ index_block_hash: Buffer }>(
      `
      -- check if the parent block is also orphaned
      SELECT index_block_hash
      FROM blocks
      WHERE 
        block_height = $1 AND 
        index_block_hash = $2 AND 
        canonical = false
      `,
      [blockResult.rows[0].block_height - 1, blockResult.rows[0].parent_index_block_hash]
    );
    if (parentResult.rowCount > 1) {
      throw new Error('found more than one non-canonical parent to restore during reorg');
    }
    if (parentResult.rowCount > 0) {
      updatedEntities.blocks++;
      await this.restoreOrphanedChain(
        client,
        parentResult.rows[0].index_block_hash,
        updatedEntities
      );
    }
    return updatedEntities;
  }

  async handleReorg(
    client: ClientBase,
    block: DbBlock,
    chainTipHeight: number
  ): Promise<UpdatedEntities> {
    const updateEntities: UpdatedEntities = {
      blocks: 0,
      txs: 0,
      stxEvents: 0,
      ftEvents: 0,
      nftEvents: 0,
      contractLogs: 0,
      smartContracts: 0,
    };

    // Check if incoming block's parent is canonical
    if (block.block_height > 1) {
      const parentResult = await client.query<{
        canonical: boolean;
        index_block_hash: Buffer;
        parent_index_block_hash: Buffer;
      }>(
        `
        SELECT canonical, index_block_hash, parent_index_block_hash
        FROM blocks
        WHERE block_height = $1 AND index_block_hash = $2
        `,
        [block.block_height - 1, hexToBuffer(block.parent_index_block_hash)]
      );

      if (parentResult.rowCount > 1) {
        throw new Error(
          `DB contains multiple blocks at height ${block.block_height - 1} and index_hash ${
            block.parent_index_block_hash
          }`
        );
      }
      if (parentResult.rowCount === 0) {
        throw new Error(
          `DB does not contain a parent block at height ${block.block_height - 1} with index_hash ${
            block.parent_index_block_hash
          }`
        );
      }

      // This blocks builds off a previously orphaned chain. Restore canonical status for this chain.
      if (!parentResult.rows[0].canonical && block.block_height > chainTipHeight) {
        updateEntities.blocks++;
        await this.restoreOrphanedChain(
          client,
          parentResult.rows[0].index_block_hash,
          updateEntities
        );
        logger.warn(`Marked ${updateEntities.blocks} blocks events as canonical`);
        logger.warn(`Marked ${updateEntities.txs} stx-token events as canonical`);
        logger.warn(`Marked ${updateEntities.stxEvents} stx-token events as canonical`);
        logger.warn(`Marked ${updateEntities.nftEvents} non-fungible-tokens events as canonical`);
        logger.warn(`Marked ${updateEntities.ftEvents} fungible-tokens events as canonical`);
        logger.warn(`Marked ${updateEntities.contractLogs} contract logs as canonical`);
        logger.warn(`Marked ${updateEntities.smartContracts} smart contracts as canonical`);
      }
    }
    return updateEntities;
  }

  static async connect(): Promise<PgDataStore> {
    const clientConfig = getPgClientConfig();

    const initTimer = stopwatch();
    let connectionError: Error;
    let connectionOkay = false;
    do {
      const client = new Client(clientConfig);
      try {
        await client.connect();
        connectionOkay = true;
        break;
      } catch (error) {
        if (
          error.code !== 'ECONNREFUSED' &&
          error.message !== 'Connection terminated unexpectedly'
        ) {
          logError('Cannot connect to pg', error);
          throw error;
        }
        logError('Pg connection failed, retrying in 2000ms..');
        connectionError = error;
        await timeout(2000);
      } finally {
        client.end(() => {});
      }
    } while (initTimer.getElapsed() < 10000);
    if (!connectionOkay) {
      connectionError = connectionError! ?? new Error('Error connecting to database');
      throw connectionError;
    }

    await runMigrations(clientConfig);
    const pool = new Pool({
      ...clientConfig,
      // application_name: `stacks-core-sidecar-${getCurrentGitTag()}`,
    });
    let poolClient: PoolClient | undefined;
    try {
      poolClient = await pool.connect();
      return new PgDataStore(pool);
    } catch (error) {
      logError(
        `Error connecting to Postgres using ${JSON.stringify(clientConfig)}: ${error}`,
        error
      );
      throw error;
    } finally {
      poolClient?.release();
    }
  }

  async updateBlock(client: ClientBase, block: DbBlock): Promise<number> {
    const result = await client.query(
      `
      INSERT INTO blocks(
        block_hash, index_block_hash, parent_index_block_hash, parent_block_hash, parent_microblock, block_height, burn_block_time, canonical
      ) values($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (index_block_hash)
      DO NOTHING
      `,
      [
        hexToBuffer(block.block_hash),
        hexToBuffer(block.index_block_hash),
        hexToBuffer(block.parent_index_block_hash),
        hexToBuffer(block.parent_block_hash),
        hexToBuffer(block.parent_microblock),
        block.block_height,
        block.burn_block_time,
        block.canonical,
      ]
    );
    return result.rowCount;
  }

  parseBlockQueryResult(row: BlockQueryResult): DbBlock {
    const block: DbBlock = {
      block_hash: bufferToHexPrefixString(row.block_hash),
      index_block_hash: bufferToHexPrefixString(row.index_block_hash),
      parent_index_block_hash: bufferToHexPrefixString(row.parent_index_block_hash),
      parent_block_hash: bufferToHexPrefixString(row.parent_block_hash),
      parent_microblock: bufferToHexPrefixString(row.parent_microblock),
      block_height: row.block_height,
      burn_block_time: row.burn_block_time,
      canonical: row.canonical,
    };
    return block;
  }

  async getBlock(blockHash: string) {
    const result = await this.pool.query<BlockQueryResult>(
      `
      SELECT ${BLOCK_COLUMNS}
      FROM blocks
      WHERE block_hash = $1
      ORDER BY canonical DESC, block_height DESC
      LIMIT 1
      `,
      [hexToBuffer(blockHash)]
    );
    if (result.rowCount === 0) {
      return { found: false } as const;
    }
    const row = result.rows[0];
    const block = this.parseBlockQueryResult(row);
    return { found: true, result: block } as const;
  }

  async getBlocks({ limit, offset }: { limit: number; offset: number }) {
    const totalQuery = this.pool.query<{ count: number }>(`
      SELECT COUNT(*)::integer
      FROM blocks
      WHERE canonical = true
    `);
    const resultQuery = this.pool.query<BlockQueryResult>(
      `
      SELECT ${BLOCK_COLUMNS}
      FROM blocks
      WHERE canonical = true
      ORDER BY block_height DESC
      LIMIT $1
      OFFSET $2
      `,
      [limit, offset]
    );
    const [total, results] = await Promise.all([totalQuery, resultQuery]);
    const parsed = results.rows.map(r => this.parseBlockQueryResult(r));
    return { results: parsed, total: total.rows[0].count } as const;
  }

  async getBlockTxs(indexBlockHash: string) {
    const result = await this.pool.query<{ tx_id: Buffer; tx_index: number }>(
      `
      SELECT tx_id, tx_index
      FROM txs
      WHERE index_block_hash = $1
      `,
      [hexToBuffer(indexBlockHash)]
    );
    const txIds = result.rows.sort(tx => tx.tx_index).map(tx => bufferToHexPrefixString(tx.tx_id));
    return { results: txIds };
  }

  async updateTx(client: ClientBase, tx: DbTx): Promise<number> {
    const result = await client.query(
      `
      INSERT INTO txs(
        ${TX_COLUMNS}
      ) values($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      ON CONFLICT ON CONSTRAINT unique_tx_id_index_block_hash
      DO NOTHING
      `,
      [
        hexToBuffer(tx.tx_id),
        tx.tx_index,
        hexToBuffer(tx.index_block_hash),
        hexToBuffer(tx.block_hash),
        tx.block_height,
        tx.burn_block_time,
        tx.type_id,
        tx.status,
        tx.canonical,
        tx.post_conditions,
        tx.fee_rate,
        tx.sponsored,
        tx.sender_address,
        tx.origin_hash_mode,
        tx.token_transfer_recipient_address,
        tx.token_transfer_amount,
        tx.token_transfer_memo,
        tx.smart_contract_contract_id,
        tx.smart_contract_source_code,
        tx.contract_call_contract_id,
        tx.contract_call_function_name,
        tx.contract_call_function_args,
        tx.poison_microblock_header_1,
        tx.poison_microblock_header_2,
        tx.coinbase_payload,
      ]
    );
    return result.rowCount;
  }

  parseTxQueryResult(result: TxQueryResult): DbTx {
    const tx: DbTx = {
      tx_id: bufferToHexPrefixString(result.tx_id),
      tx_index: result.tx_index,
      index_block_hash: bufferToHexPrefixString(result.index_block_hash),
      block_hash: bufferToHexPrefixString(result.block_hash),
      block_height: result.block_height,
      burn_block_time: result.burn_block_time,
      type_id: result.type_id as DbTxTypeId,
      status: result.status,
      canonical: result.canonical,
      post_conditions: result.post_conditions,
      fee_rate: BigInt(result.fee_rate),
      sponsored: result.sponsored,
      sender_address: result.sender_address,
      origin_hash_mode: result.origin_hash_mode,
    };
    if (tx.type_id === DbTxTypeId.TokenTransfer) {
      tx.token_transfer_recipient_address = result.token_transfer_recipient_address;
      tx.token_transfer_amount = BigInt(result.token_transfer_amount);
      tx.token_transfer_memo = result.token_transfer_memo;
    } else if (tx.type_id === DbTxTypeId.SmartContract) {
      tx.smart_contract_contract_id = result.smart_contract_contract_id;
      tx.smart_contract_source_code = result.smart_contract_source_code;
    } else if (tx.type_id === DbTxTypeId.ContractCall) {
      tx.contract_call_contract_id = result.contract_call_contract_id;
      tx.contract_call_function_name = result.contract_call_function_name;
      tx.contract_call_function_args = result.contract_call_function_args;
    } else if (tx.type_id === DbTxTypeId.PoisonMicroblock) {
      tx.poison_microblock_header_1 = result.poison_microblock_header_1;
      tx.poison_microblock_header_2 = result.poison_microblock_header_2;
    } else if (tx.type_id === DbTxTypeId.Coinbase) {
      tx.coinbase_payload = result.coinbase_payload;
    } else {
      throw new Error(`Received unexpected tx type_id from db query: ${tx.type_id}`);
    }
    return tx;
  }

  parseFaucetRequestQueryResult(result: FaucetRequestQueryResult): DbFaucetRequest {
    const tx: DbFaucetRequest = {
      currency: result.currency as DbFaucetRequestCurrency,
      address: result.address,
      ip: result.ip,
      occurred_at: result.occurred_at,
    };
    return tx;
  }

  async getTx(txId: string) {
    const result = await this.pool.query<TxQueryResult>(
      `
      SELECT ${TX_COLUMNS}
      FROM txs
      WHERE tx_id = $1
      ORDER BY canonical DESC, block_height DESC
      LIMIT 1
      `,
      [hexToBuffer(txId)]
    );
    if (result.rowCount === 0) {
      return { found: false } as const;
    }
    const row = result.rows[0];
    const tx = this.parseTxQueryResult(row);
    return { found: true, result: tx };
  }

  async getTxList({
    limit,
    offset,
    txTypeFilter,
  }: {
    limit: number;
    offset: number;
    txTypeFilter: TransactionType[];
  }) {
    let totalQuery: QueryResult<{ count: number }>;
    let resultQuery: QueryResult<TxQueryResult>;
    if (txTypeFilter.length === 0) {
      totalQuery = await this.pool.query<{ count: number }>(
        `
        SELECT COUNT(*)::integer
        FROM txs
        WHERE canonical = true
        `
      );
      resultQuery = await this.pool.query<TxQueryResult>(
        `
        SELECT ${TX_COLUMNS}
        FROM txs
        WHERE canonical = true
        ORDER BY block_height DESC, tx_index DESC
        LIMIT $1
        OFFSET $2
        `,
        [limit, offset]
      );
    } else {
      const txTypeIds = txTypeFilter.map<number>(t => getTxTypeId(t));
      totalQuery = await this.pool.query<{ count: number }>(
        `
        SELECT COUNT(*)::integer
        FROM txs
        WHERE canonical = true AND type_id = ANY($1)
        `,
        [txTypeIds]
      );
      resultQuery = await this.pool.query<TxQueryResult>(
        `
        SELECT ${TX_COLUMNS}
        FROM txs
        WHERE canonical = true AND type_id = ANY($1)
        ORDER BY block_height DESC, tx_index DESC
        LIMIT $2
        OFFSET $3
        `,
        [txTypeIds, limit, offset]
      );
    }
    const parsed = resultQuery.rows.map(r => this.parseTxQueryResult(r));
    return { results: parsed, total: totalQuery.rows[0].count };
  }

  async getTxEvents(txId: string, indexBlockHash: string) {
    const client = await this.pool.connect();
    try {
      const txIdBuffer = hexToBuffer(txId);
      const blockHashBuffer = hexToBuffer(indexBlockHash);
      const stxResults = await client.query<{
        event_index: number;
        tx_id: Buffer;
        tx_index: number;
        block_height: number;
        canonical: boolean;
        asset_event_type_id: number;
        sender?: string;
        recipient?: string;
        amount: string;
      }>(
        `
        SELECT 
          event_index, tx_id, tx_index, block_height, canonical, asset_event_type_id, sender, recipient, amount 
        FROM stx_events 
        WHERE tx_id = $1 AND index_block_hash = $2
        `,
        [txIdBuffer, blockHashBuffer]
      );
      const ftResults = await client.query<{
        event_index: number;
        tx_id: Buffer;
        tx_index: number;
        block_height: number;
        canonical: boolean;
        asset_event_type_id: number;
        sender?: string;
        recipient?: string;
        asset_identifier: string;
        amount: string;
      }>(
        `
        SELECT 
          event_index, tx_id, tx_index, block_height, canonical, asset_event_type_id, sender, recipient, asset_identifier, amount 
        FROM ft_events 
        WHERE tx_id = $1 AND index_block_hash = $2
        `,
        [txIdBuffer, blockHashBuffer]
      );
      const nftResults = await client.query<{
        event_index: number;
        tx_id: Buffer;
        tx_index: number;
        block_height: number;
        canonical: boolean;
        asset_event_type_id: number;
        sender?: string;
        recipient?: string;
        asset_identifier: string;
        value: Buffer;
      }>(
        `
        SELECT 
          event_index, tx_id, tx_index, block_height, canonical, asset_event_type_id, sender, recipient, asset_identifier, value 
        FROM nft_events 
        WHERE tx_id = $1 AND index_block_hash = $2
        `,
        [txIdBuffer, blockHashBuffer]
      );
      const logResults = await client.query<{
        event_index: number;
        tx_id: Buffer;
        tx_index: number;
        block_height: number;
        canonical: boolean;
        contract_identifier: string;
        topic: string;
        value: Buffer;
      }>(
        `
        SELECT 
          event_index, tx_id, tx_index, block_height, canonical, contract_identifier, topic, value 
        FROM contract_logs 
        WHERE tx_id = $1 AND index_block_hash = $2
        `,
        [txIdBuffer, blockHashBuffer]
      );
      const events = new Array<DbEvent>(
        stxResults.rowCount + nftResults.rowCount + ftResults.rowCount + logResults.rowCount
      );
      let rowIndex = 0;
      for (const result of stxResults.rows) {
        const event: DbStxEvent = {
          event_index: result.event_index,
          tx_id: bufferToHexPrefixString(result.tx_id),
          tx_index: result.tx_index,
          block_height: result.block_height,
          canonical: result.canonical,
          asset_event_type_id: result.asset_event_type_id,
          sender: result.sender,
          recipient: result.recipient,
          event_type: DbEventTypeId.StxAsset,
          amount: BigInt(result.amount),
        };
        events[rowIndex++] = event;
      }
      for (const result of ftResults.rows) {
        const event: DbFtEvent = {
          event_index: result.event_index,
          tx_id: bufferToHexPrefixString(result.tx_id),
          tx_index: result.tx_index,
          block_height: result.block_height,
          canonical: result.canonical,
          asset_event_type_id: result.asset_event_type_id,
          sender: result.sender,
          recipient: result.recipient,
          asset_identifier: result.asset_identifier,
          event_type: DbEventTypeId.FungibleTokenAsset,
          amount: BigInt(result.amount),
        };
        events[rowIndex++] = event;
      }
      for (const result of nftResults.rows) {
        const event: DbNftEvent = {
          event_index: result.event_index,
          tx_id: bufferToHexPrefixString(result.tx_id),
          tx_index: result.tx_index,
          block_height: result.block_height,
          canonical: result.canonical,
          asset_event_type_id: result.asset_event_type_id,
          sender: result.sender,
          recipient: result.recipient,
          asset_identifier: result.asset_identifier,
          event_type: DbEventTypeId.NonFungibleTokenAsset,
          value: result.value,
        };
        events[rowIndex++] = event;
      }
      for (const result of logResults.rows) {
        const event: DbSmartContractEvent = {
          event_index: result.event_index,
          tx_id: bufferToHexPrefixString(result.tx_id),
          tx_index: result.tx_index,
          block_height: result.block_height,
          canonical: result.canonical,
          event_type: DbEventTypeId.SmartContractLog,
          contract_identifier: result.contract_identifier,
          topic: result.topic,
          value: result.value,
        };
        events[rowIndex++] = event;
      }
      events.sort((a, b) => a.event_index - b.event_index);
      return { results: events };
    } finally {
      client.release();
    }
  }

  async updateStxEvent(client: ClientBase, tx: DbTx, event: DbStxEvent) {
    await client.query(
      `
      INSERT INTO stx_events(
        event_index, tx_id, tx_index, block_height, index_block_hash, canonical, asset_event_type_id, sender, recipient, amount
      ) values($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        event.event_index,
        hexToBuffer(event.tx_id),
        event.tx_index,
        event.block_height,
        hexToBuffer(tx.index_block_hash),
        event.canonical,
        event.asset_event_type_id,
        event.sender,
        event.recipient,
        event.amount,
      ]
    );
  }

  async updateFtEvent(client: ClientBase, tx: DbTx, event: DbFtEvent) {
    await client.query(
      `
      INSERT INTO ft_events(
        event_index, tx_id, tx_index, block_height, index_block_hash, canonical, asset_event_type_id, sender, recipient, asset_identifier, amount
      ) values($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        event.event_index,
        hexToBuffer(event.tx_id),
        event.tx_index,
        event.block_height,
        hexToBuffer(tx.index_block_hash),
        event.canonical,
        event.asset_event_type_id,
        event.sender,
        event.recipient,
        event.asset_identifier,
        event.amount,
      ]
    );
  }

  async updateNftEvent(client: ClientBase, tx: DbTx, event: DbNftEvent) {
    await client.query(
      `
      INSERT INTO nft_events(
        event_index, tx_id, tx_index, block_height, index_block_hash, canonical, asset_event_type_id, sender, recipient, asset_identifier, value
      ) values($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        event.event_index,
        hexToBuffer(event.tx_id),
        event.tx_index,
        event.block_height,
        hexToBuffer(tx.index_block_hash),
        event.canonical,
        event.asset_event_type_id,
        event.sender,
        event.recipient,
        event.asset_identifier,
        event.value,
      ]
    );
  }

  async updateSmartContractEvent(client: ClientBase, tx: DbTx, event: DbSmartContractEvent) {
    await client.query(
      `
      INSERT INTO contract_logs(
        event_index, tx_id, tx_index, block_height, index_block_hash, canonical, contract_identifier, topic, value
      ) values($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        event.event_index,
        hexToBuffer(event.tx_id),
        event.tx_index,
        event.block_height,
        hexToBuffer(tx.index_block_hash),
        event.canonical,
        event.contract_identifier,
        event.topic,
        event.value,
      ]
    );
  }

  async updateSmartContract(client: ClientBase, tx: DbTx, smartContract: DbSmartContract) {
    await client.query(
      `
      INSERT INTO smart_contracts(
        tx_id, canonical, contract_id, block_height, index_block_hash, source_code, abi
      ) values($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        hexToBuffer(smartContract.tx_id),
        smartContract.canonical,
        smartContract.contract_id,
        smartContract.block_height,
        hexToBuffer(tx.index_block_hash),
        smartContract.source_code,
        smartContract.abi,
      ]
    );
  }

  async getSmartContract(contractId: string) {
    const result = await this.pool.query<{
      tx_id: Buffer;
      canonical: boolean;
      contract_id: string;
      block_height: number;
      source_code: string;
      abi: string;
    }>(
      `
      SELECT tx_id, canonical, contract_id, block_height, source_code, abi
      FROM smart_contracts
      WHERE contract_id = $1
      ORDER BY canonical DESC, block_height DESC
      LIMIT 1
      `,
      [contractId]
    );
    if (result.rowCount === 0) {
      return { found: false } as const;
    }
    const row = result.rows[0];
    const smartContract: DbSmartContract = {
      tx_id: bufferToHexPrefixString(row.tx_id),
      canonical: row.canonical,
      contract_id: row.contract_id,
      block_height: row.block_height,
      source_code: row.source_code,
      abi: row.abi,
    };
    return { found: true, result: smartContract };
  }

  async getStxBalance(
    stxAddress: string
  ): Promise<{ balance: bigint; totalSent: bigint; totalReceived: bigint }> {
    const result = await this.pool.query<{
      credit_total: string | null;
      debit_total: string | null;
    }>(
      `
      WITH transfers AS (
        SELECT amount, sender, recipient
        FROM stx_events
        WHERE canonical = true AND (sender = $1 OR recipient = $1)
      ), credit AS (
        SELECT sum(amount) as credit_total
        FROM transfers
        WHERE recipient = $1
      ), debit AS (
        SELECT sum(amount) as debit_total
        FROM transfers
        WHERE sender = $1
      )
      SELECT credit_total, debit_total
      FROM credit CROSS JOIN debit
      `,
      [stxAddress]
    );
    const totalSent = BigInt(result.rows[0].debit_total ?? 0);
    const totalReceived = BigInt(result.rows[0].credit_total ?? 0);
    const balanceTotal = totalReceived - totalSent;
    return {
      balance: balanceTotal,
      totalSent,
      totalReceived,
    };
  }

  async getAddressAssetEvents({
    stxAddress,
    limit,
    offset,
  }: {
    stxAddress: string;
    limit: number;
    offset: number;
  }): Promise<{ results: DbEvent[]; total: number }> {
    const results = await this.pool.query<{
      asset_type: 'stx' | 'ft' | 'nft';
      event_index: number;
      tx_id: Buffer;
      tx_index: number;
      block_height: number;
      canonical: boolean;
      asset_event_type_id: number;
      sender?: string;
      recipient?: string;
      asset_identifier: string;
      amount?: string;
      value?: Buffer;
    }>(
      `
      SELECT * FROM (
        SELECT 
          'stx' as asset_type, event_index, tx_id, tx_index, block_height, canonical, asset_event_type_id, sender, recipient, '<stx>' as asset_identifier, amount::numeric(78, 0), null::bytea as value
        FROM stx_events 
        WHERE canonical = true AND (sender = $1 OR recipient = $1)
        UNION ALL
        SELECT 
          'ft' as asset_type, event_index, tx_id, tx_index, block_height, canonical, asset_event_type_id, sender, recipient, asset_identifier, amount, null::bytea as value
        FROM ft_events 
        WHERE canonical = true AND (sender = $1 OR recipient = $1)
        UNION ALL
        SELECT 
          'nft' as asset_type, event_index, tx_id, tx_index, block_height, canonical, asset_event_type_id, sender, recipient, asset_identifier, null::numeric(78, 0) as amount, value 
        FROM nft_events 
        WHERE canonical = true AND (sender = $1 OR recipient = $1)
      ) asset_events
      ORDER BY block_height DESC, tx_index DESC, event_index DESC
      LIMIT $2
      OFFSET $3
      `,
      [stxAddress, limit, offset]
    );

    const events: DbEvent[] = results.rows.map(row => {
      if (row.asset_type === 'stx') {
        const event: DbStxEvent = {
          event_index: row.event_index,
          tx_id: bufferToHexPrefixString(row.tx_id),
          tx_index: row.tx_index,
          block_height: row.block_height,
          canonical: row.canonical,
          asset_event_type_id: row.asset_event_type_id,
          sender: row.sender,
          recipient: row.recipient,
          event_type: DbEventTypeId.StxAsset,
          amount: BigInt(row.amount),
        };
        return event;
      } else if (row.asset_type === 'ft') {
        const event: DbFtEvent = {
          event_index: row.event_index,
          tx_id: bufferToHexPrefixString(row.tx_id),
          tx_index: row.tx_index,
          block_height: row.block_height,
          canonical: row.canonical,
          asset_event_type_id: row.asset_event_type_id,
          sender: row.sender,
          recipient: row.recipient,
          asset_identifier: row.asset_identifier,
          event_type: DbEventTypeId.FungibleTokenAsset,
          amount: BigInt(row.amount),
        };
        return event;
      } else if (row.asset_type === 'nft') {
        const event: DbNftEvent = {
          event_index: row.event_index,
          tx_id: bufferToHexPrefixString(row.tx_id),
          tx_index: row.tx_index,
          block_height: row.block_height,
          canonical: row.canonical,
          asset_event_type_id: row.asset_event_type_id,
          sender: row.sender,
          recipient: row.recipient,
          asset_identifier: row.asset_identifier,
          event_type: DbEventTypeId.NonFungibleTokenAsset,
          value: row.value!,
        };
        return event;
      } else {
        throw new Error(`Unexpected asset_type "${row.asset_type}"`);
      }
    });
    return {
      results: events,
      total: 0,
    };
  }

  async getFungibleTokenBalances(
    stxAddress: string
  ): Promise<Map<string, { balance: bigint; totalSent: bigint; totalReceived: bigint }>> {
    const result = await this.pool.query<{
      asset_identifier: string;
      credit_total: string | null;
      debit_total: string | null;
    }>(
      `
      WITH transfers AS (
        SELECT amount, sender, recipient, asset_identifier
        FROM ft_events
        WHERE canonical = true AND (sender = $1 OR recipient = $1)
      ), credit AS (
        SELECT asset_identifier, sum(amount) as credit_total
        FROM transfers
        WHERE recipient = $1
        GROUP BY asset_identifier
      ), debit AS (
        SELECT asset_identifier, sum(amount) as debit_total
        FROM transfers
        WHERE sender = $1
        GROUP BY asset_identifier
      )
      SELECT coalesce(credit.asset_identifier, debit.asset_identifier) as asset_identifier, credit_total, debit_total
      FROM credit FULL JOIN debit USING (asset_identifier)
      `,
      [stxAddress]
    );
    // sort by asset name (case-insensitive)
    const rows = result.rows.sort((r1, r2) =>
      r1.asset_identifier.localeCompare(r2.asset_identifier)
    );
    const assetBalances = new Map(
      rows.map(r => {
        const totalSent = BigInt(r.debit_total ?? 0);
        const totalReceived = BigInt(r.credit_total ?? 0);
        const balance = totalReceived - totalSent;
        return [r.asset_identifier, { balance, totalSent, totalReceived }];
      })
    );
    return assetBalances;
  }

  async getNonFungibleTokenCounts(
    stxAddress: string
  ): Promise<Map<string, { count: bigint; totalSent: bigint; totalReceived: bigint }>> {
    const result = await this.pool.query<{
      asset_identifier: string;
      received_total: string | null;
      sent_total: string | null;
    }>(
      `
      WITH transfers AS (
        SELECT sender, recipient, asset_identifier
        FROM nft_events
        WHERE canonical = true AND (sender = $1 OR recipient = $1)
      ), credit AS (
        SELECT asset_identifier, COUNT(*) as received_total
        FROM transfers
        WHERE recipient = $1
        GROUP BY asset_identifier
      ), debit AS (
        SELECT asset_identifier, COUNT(*) as sent_total
        FROM transfers
        WHERE sender = $1
        GROUP BY asset_identifier
      )
      SELECT coalesce(credit.asset_identifier, debit.asset_identifier) as asset_identifier, received_total, sent_total
      FROM credit FULL JOIN debit USING (asset_identifier)
      `,
      [stxAddress]
    );
    // sort by asset name (case-insensitive)
    const rows = result.rows.sort((r1, r2) =>
      r1.asset_identifier.localeCompare(r2.asset_identifier)
    );
    const assetBalances = new Map(
      rows.map(r => {
        const totalSent = BigInt(r.sent_total ?? 0);
        const totalReceived = BigInt(r.received_total ?? 0);
        const count = totalReceived - totalSent;
        return [r.asset_identifier, { count, totalSent, totalReceived }];
      })
    );
    return assetBalances;
  }

  async getAddressTxs({
    stxAddress,
    limit,
    offset,
  }: {
    stxAddress: string;
    limit: number;
    offset: number;
  }): Promise<{ results: DbTx[]; total: number }> {
    const resultQuery = await this.pool.query<TxQueryResult & { count: number }>(
      `
      WITH transactions AS (
        SELECT *, (COUNT(*) OVER())::integer as count
        FROM txs
        WHERE canonical = true AND (sender_address = $1 OR token_transfer_recipient_address = $1)
      )
      SELECT ${TX_COLUMNS}, count
      FROM transactions
      ORDER BY block_height DESC, tx_index DESC
      LIMIT $2
      OFFSET $3
      `,
      [stxAddress, limit, offset]
    );
    const count = resultQuery.rowCount > 0 ? resultQuery.rows[0].count : 0;
    const parsed = resultQuery.rows.map(r => this.parseTxQueryResult(r));
    return { results: parsed, total: count };
  }

  async insertFaucetRequest(faucetRequest: DbFaucetRequest) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `
        INSERT INTO faucet_requests(
          currency, address, ip, occurred_at
        ) values($1, $2, $3, $4)
        `,
        [faucetRequest.currency, faucetRequest.address, faucetRequest.ip, faucetRequest.occurred_at]
      );
      await client.query('COMMIT');
    } catch (error) {
      logError(`Error performing PG update: ${error}`, error);
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getBTCFaucetRequest(address: string) {
    const result = await this.pool.query<FaucetRequestQueryResult>(
      `
      SELECT ip, address, currency, occurred_at
      FROM faucet_requests
      WHERE address = $1 AND currency = 'btc'
      `,
      [address]
    );
    if (result.rowCount === 0) {
      return { found: false } as const;
    }
    const row = result.rows[0];
    const faucetRequest = this.parseFaucetRequestQueryResult(row);
    return { found: true, result: faucetRequest };
  }

  async getSTXFaucetRequest(address: string) {
    const result = await this.pool.query<FaucetRequestQueryResult>(
      `
      SELECT ip, address, currency, occurred_at
      FROM faucet_requests
      WHERE address = $1 AND currency = 'stx'
      `,
      [address]
    );
    if (result.rowCount === 0) {
      return { found: false } as const;
    }
    const row = result.rows[0];
    const faucetRequest = this.parseFaucetRequestQueryResult(row);
    return { found: true, result: faucetRequest };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
