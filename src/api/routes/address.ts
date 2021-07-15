import * as express from 'express';
import { addAsync, RouterWithAsync } from '@awaitjs/express';
import * as Bluebird from 'bluebird';
import { DataStore } from '../../datastore/common';
import { parseLimitQuery, parsePagingQueryInput } from '../pagination';
import { isUnanchoredRequest } from '../query-helpers';
import {
  bufferToHexPrefixString,
  formatMapToObject,
  getSendManyContract,
  isProdEnv,
  isValidC32Address,
  isValidPrincipal,
  logger,
} from '../../helpers';
import { getTxFromDataStore, parseDbEvent, parseDbMempoolTx } from '../controllers/db-controller';
import {
  TransactionResults,
  TransactionEvent,
  AddressBalanceResponse,
  AddressStxBalanceResponse,
  AddressStxInboundListResponse,
  InboundStxTransfer,
  AddressNftListResponse,
  MempoolTransactionListResponse,
  AddressTransactionWithTransfers,
  AddressTransactionsWithTransfersListResponse,
  AddressNonces,
} from '@stacks/stacks-blockchain-api-types';
import { ChainID, cvToString, deserializeCV } from '@stacks/transactions';
import { validate } from '../validate';

const MAX_TX_PER_REQUEST = 50;
const MAX_ASSETS_PER_REQUEST = 50;
const MAX_STX_INBOUND_PER_REQUEST = 500;

const parseTxQueryLimit = parseLimitQuery({
  maxItems: MAX_TX_PER_REQUEST,
  errorMsg: '`limit` must be equal to or less than ' + MAX_TX_PER_REQUEST,
});

const parseAssetsQueryLimit = parseLimitQuery({
  maxItems: MAX_ASSETS_PER_REQUEST,
  errorMsg: '`limit` must be equal to or less than ' + MAX_ASSETS_PER_REQUEST,
});

const parseStxInboundLimit = parseLimitQuery({
  maxItems: MAX_STX_INBOUND_PER_REQUEST,
  errorMsg: '`limit` must be equal to or less than ' + MAX_STX_INBOUND_PER_REQUEST,
});

interface AddressAssetEvents {
  results: TransactionEvent[];
  limit: number;
  offset: number;
  total: number;
}

export function createAddressRouter(db: DataStore, chainId: ChainID): RouterWithAsync {
  const router = addAsync(express.Router());

  router.getAsync('/:stx_address/stx', async (req, res) => {
    const stxAddress = req.params['stx_address'];
    if (!isValidPrincipal(stxAddress)) {
      return res.status(400).json({ error: `invalid STX address "${stxAddress}"` });
    }
    // Get balance info for STX token
    const currentBlockHeight = await db.getCurrentBlockHeight();
    if (!currentBlockHeight.found) {
      return res.status(500).json({ error: `no current block` });
    }
    const stxBalanceResult = await db.getStxBalanceAtBlock(stxAddress, currentBlockHeight.result);
    const tokenOfferingLocked = await db.getTokenOfferingLocked(
      stxAddress,
      currentBlockHeight.result
    );
    const result: AddressStxBalanceResponse = {
      balance: stxBalanceResult.balance.toString(),
      total_sent: stxBalanceResult.totalSent.toString(),
      total_received: stxBalanceResult.totalReceived.toString(),
      total_fees_sent: stxBalanceResult.totalFeesSent.toString(),
      total_miner_rewards_received: stxBalanceResult.totalMinerRewardsReceived.toString(),
      lock_tx_id: stxBalanceResult.lockTxId,
      locked: stxBalanceResult.locked.toString(),
      lock_height: stxBalanceResult.lockHeight,
      burnchain_lock_height: stxBalanceResult.burnchainLockHeight,
      burnchain_unlock_height: stxBalanceResult.burnchainUnlockHeight,
    };

    if (tokenOfferingLocked.found) {
      result.token_offering_locked = tokenOfferingLocked.result;
    }
    res.json(result);
  });

  // get balances for STX, FTs, and counts for NFTs
  router.getAsync('/:stx_address/balances', async (req, res, next) => {
    const stxAddress = req.params['stx_address'];
    if (!isValidPrincipal(stxAddress)) {
      return res.status(400).json({ error: `invalid STX address "${stxAddress}"` });
    }

    const includeUnanchored = isUnanchoredRequest(req, res, next);
    if (typeof includeUnanchored !== 'boolean') {
      return;
    }

    const currentBlockHeight = await db.getCurrentBlockHeight();
    if (!currentBlockHeight.found) {
      return res.status(500).json({ error: `no current block` });
    }

    // Get balance info for STX token
    const stxBalanceResult = await db.getStxBalanceAtBlock(stxAddress, currentBlockHeight.result);
    const tokenOfferingLocked = await db.getTokenOfferingLocked(
      stxAddress,
      currentBlockHeight.result
    );

    // Get balances for fungible tokens
    const ftBalancesResult = await db.getFungibleTokenBalances({ stxAddress, includeUnanchored });
    const ftBalances = formatMapToObject(ftBalancesResult, val => {
      return {
        balance: val.balance.toString(),
        total_sent: val.totalSent.toString(),
        total_received: val.totalReceived.toString(),
      };
    });

    // Get counts for non-fungible tokens
    const nftBalancesResult = await db.getNonFungibleTokenCounts({ stxAddress, includeUnanchored });
    const nftBalances = formatMapToObject(nftBalancesResult, val => {
      return {
        count: val.count.toString(),
        total_sent: val.totalSent.toString(),
        total_received: val.totalReceived.toString(),
      };
    });

    const result: AddressBalanceResponse = {
      stx: {
        balance: stxBalanceResult.balance.toString(),
        total_sent: stxBalanceResult.totalSent.toString(),
        total_received: stxBalanceResult.totalReceived.toString(),
        total_fees_sent: stxBalanceResult.totalFeesSent.toString(),
        total_miner_rewards_received: stxBalanceResult.totalMinerRewardsReceived.toString(),
        lock_tx_id: stxBalanceResult.lockTxId,
        locked: stxBalanceResult.locked.toString(),
        lock_height: stxBalanceResult.lockHeight,
        burnchain_lock_height: stxBalanceResult.burnchainLockHeight,
        burnchain_unlock_height: stxBalanceResult.burnchainUnlockHeight,
      },
      fungible_tokens: ftBalances,
      non_fungible_tokens: nftBalances,
    };

    if (tokenOfferingLocked.found) {
      result.token_offering_locked = tokenOfferingLocked.result;
    }

    res.json(result);
  });

  router.getAsync('/:stx_address/transactions', async (req, res, next) => {
    // get recent txs associated (sender or receiver) with address
    const stxAddress = req.params['stx_address'];
    if (!isValidPrincipal(stxAddress)) {
      return res.status(400).json({ error: `invalid STX address "${stxAddress}"` });
    }

    let args:
      | {
          height: number;
        }
      | {
          includeUnanchored: boolean;
        };
    if ('height' in req.query) {
      const heightFilter = parseInt(req.query['height'] as string, 10);
      if (!Number.isInteger(heightFilter)) {
        return res
          .status(400)
          .json({ error: `height is not a valid integer: ${req.query['height']}` });
      }
      if (heightFilter < 1) {
        return res.status(400).json({ error: `height is not a positive integer: ${heightFilter}` });
      }
      args = { height: heightFilter };
    } else {
      const includeUnanchored = isUnanchoredRequest(req, res, next);
      if (typeof includeUnanchored !== 'boolean') {
        return;
      }
      args = { includeUnanchored };
    }

    const limit = parseTxQueryLimit(req.query.limit ?? 20);
    const offset = parsePagingQueryInput(req.query.offset ?? 0);
    const { results: txResults, total } = await db.getAddressTxs({
      stxAddress: stxAddress,
      limit,
      offset,
      ...args,
    });
    const results = await Bluebird.mapSeries(txResults, async tx => {
      const txQuery = await getTxFromDataStore(db, { txId: tx.tx_id, includeUnanchored: true });
      if (!txQuery.found) {
        throw new Error('unexpected tx not found -- fix tx enumeration query');
      }
      return txQuery.result;
    });
    const response: TransactionResults = { limit, offset, total, results };
    res.json(response);
  });

  router.getAsync('/:stx_address/transactions_with_transfers', async (req, res, next) => {
    const stxAddress = req.params['stx_address'];
    if (!isValidPrincipal(stxAddress)) {
      return res.status(400).json({ error: `invalid STX address "${stxAddress}"` });
    }

    let args:
      | {
          height: number;
        }
      | {
          includeUnanchored: boolean;
        };
    if ('height' in req.query) {
      const heightFilter = parseInt(req.query['height'] as string, 10);
      if (!Number.isInteger(heightFilter)) {
        return res
          .status(400)
          .json({ error: `height is not a valid integer: ${req.query['height']}` });
      }
      if (heightFilter < 1) {
        return res.status(400).json({ error: `height is not a positive integer: ${heightFilter}` });
      }
      args = { height: heightFilter };
    } else {
      const includeUnanchored = isUnanchoredRequest(req, res, next);
      if (typeof includeUnanchored !== 'boolean') {
        return;
      }
      args = { includeUnanchored };
    }

    const limit = parseTxQueryLimit(req.query.limit ?? 20);
    const offset = parsePagingQueryInput(req.query.offset ?? 0);
    const { results: txResults, total } = await db.getAddressTxsWithStxTransfers({
      stxAddress: stxAddress,
      limit,
      offset,
      ...args,
    });

    const results = await Bluebird.mapSeries(txResults, async entry => {
      const txQuery = await getTxFromDataStore(db, {
        txId: entry.tx.tx_id,
        includeUnanchored: true,
      });
      if (!txQuery.found) {
        throw new Error('unexpected tx not found -- fix tx enumeration query');
      }
      const result: AddressTransactionWithTransfers = {
        tx: txQuery.result,
        stx_sent: entry.stx_sent.toString(),
        stx_received: entry.stx_received.toString(),
        stx_transfers: entry.stx_transfers.map(transfer => ({
          amount: transfer.amount.toString(),
          sender: transfer.sender,
          recipient: transfer.recipient,
        })),
      };
      return result;
    });

    const response: AddressTransactionsWithTransfersListResponse = {
      limit,
      offset,
      total,
      results,
    };
    res.json(response);
  });

  router.getAsync('/:stx_address/assets', async (req, res, next) => {
    // get recent asset event associated with address
    const stxAddress = req.params['stx_address'];
    if (!isValidPrincipal(stxAddress)) {
      return res.status(400).json({ error: `invalid STX address "${stxAddress}"` });
    }
    const includeUnanchored = isUnanchoredRequest(req, res, next);
    if (typeof includeUnanchored !== 'boolean') {
      return;
    }
    const limit = parseAssetsQueryLimit(req.query.limit ?? 20);
    const offset = parsePagingQueryInput(req.query.offset ?? 0);
    const { results: assetEvents, total } = await db.getAddressAssetEvents({
      stxAddress,
      limit,
      offset,
      includeUnanchored,
    });
    const results = assetEvents.map(event => parseDbEvent(event));
    const response: AddressAssetEvents = { limit, offset, total, results };
    res.json(response);
  });

  router.getAsync('/:stx_address/stx_inbound', async (req, res, next) => {
    // get recent inbound STX transfers with memos
    const stxAddress = req.params['stx_address'];
    try {
      const sendManyContractId = getSendManyContract(chainId);
      if (!sendManyContractId || !isValidPrincipal(sendManyContractId)) {
        logger.error('Send many contract ID not properly configured');
        return res.status(500).json({ error: 'Send many contract ID not properly configured' });
      }
      if (!isValidPrincipal(stxAddress)) {
        return res.status(400).json({ error: `invalid STX address "${stxAddress}"` });
      }
      const limit = parseStxInboundLimit(req.query.limit ?? 20);
      const offset = parsePagingQueryInput(req.query.offset ?? 0);
      let args:
        | {
            height: number;
          }
        | {
            includeUnanchored: boolean;
          };
      if ('height' in req.query) {
        const heightFilter = parseInt(req.query['height'] as string, 10);
        if (!Number.isInteger(heightFilter)) {
          return res
            .status(400)
            .json({ error: `height is not a valid integer: ${req.query['height']}` });
        }
        if (heightFilter < 1) {
          return res
            .status(400)
            .json({ error: `height is not a positive integer: ${heightFilter}` });
        }
        args = { height: heightFilter };
      } else {
        const includeUnanchored = isUnanchoredRequest(req, res, next);
        if (typeof includeUnanchored !== 'boolean') {
          return;
        }
        args = { includeUnanchored };
      }
      const { results, total } = await db.getInboundTransfers({
        stxAddress,
        limit,
        offset,
        sendManyContractId,
        ...args,
      });
      const transfers: InboundStxTransfer[] = results.map(r => ({
        sender: r.sender,
        amount: r.amount.toString(),
        memo: r.memo,
        block_height: r.block_height,
        tx_id: r.tx_id,
        transfer_type: r.transfer_type as InboundStxTransfer['transfer_type'],
        tx_index: r.tx_index,
      }));
      const response: AddressStxInboundListResponse = {
        results: transfers,
        total: total,
        limit,
        offset,
      };
      res.json(response);
    } catch (error) {
      logger.error(`Unable to get inbound transfers for ${stxAddress}`, error);
      throw error;
    }
  });

  router.getAsync('/:stx_address/nft_events', async (req, res, next) => {
    // get recent asset event associated with address
    const stxAddress = req.params['stx_address'];
    if (!isValidPrincipal(stxAddress)) {
      return res.status(400).json({ error: `invalid STX address "${stxAddress}"` });
    }

    const limit = parseAssetsQueryLimit(req.query.limit ?? 20);
    const offset = parsePagingQueryInput(req.query.offset ?? 0);

    const includeUnanchored = isUnanchoredRequest(req, res, next);
    if (typeof includeUnanchored !== 'boolean') {
      return;
    }

    const response = await db.getAddressNFTEvent({
      stxAddress,
      limit,
      offset,
      includeUnanchored,
    });
    const nft_events = response.results.map(row => ({
      sender: row.sender,
      recipient: row.recipient,
      asset_identifier: row.asset_identifier,
      value: {
        hex: bufferToHexPrefixString(row.value),
        repr: cvToString(deserializeCV(row.value)),
      },
      tx_id: bufferToHexPrefixString(row.tx_id),
      block_height: row.block_height,
    }));
    const nftListResponse: AddressNftListResponse = {
      nft_events: nft_events,
      total: response.total,
      limit: limit,
      offset: offset,
    };
    res.json(nftListResponse);
  });

  router.getAsync('/:address/mempool', async (req, res, next) => {
    const limit = parseTxQueryLimit(req.query.limit ?? MAX_TX_PER_REQUEST);
    const offset = parsePagingQueryInput(req.query.offset ?? 0);

    const address = req.params['address'];
    if (!isValidC32Address(address)) {
      res.status(400).json({ error: `Invalid query parameter for "${address}"` });
    }

    const includeUnanchored = isUnanchoredRequest(req, res, next);
    if (typeof includeUnanchored !== 'boolean') {
      return;
    }

    const { results: txResults, total } = await db.getMempoolTxList({
      offset,
      limit,
      address,
      includeUnanchored,
    });

    const results = txResults.map(tx => parseDbMempoolTx(tx));
    const response: MempoolTransactionListResponse = { limit, offset, total, results };
    if (!isProdEnv) {
      const schemaPath =
        '@stacks/stacks-blockchain-api-types/api/transaction/get-mempool-transactions.schema.json';
      await validate(schemaPath, response);
    }
    res.json(response);
  });

  router.getAsync('/:stx_address/nonces', async (req, res) => {
    // get recent asset event associated with address
    const stxAddress = req.params['stx_address'];
    if (!isValidPrincipal(stxAddress)) {
      return res.status(400).json({ error: `invalid STX address "${stxAddress}"` });
    }
    const nonces = await db.getAddressNonces({
      stxAddress,
    });
    const results: AddressNonces = {
      last_executed_tx_nonce: nonces.lastExecutedTxNonce as number,
      last_mempool_tx_nonce: nonces.lastMempoolTxNonce as number,
      possible_next_nonce: nonces.possibleNextNonce,
      detected_missing_nonces: nonces.detectedMissingNonces,
    };
    res.json(results);
  });

  return router;
}
