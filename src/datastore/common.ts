import * as crypto from 'crypto';
import { hexToBuffer } from '../helpers';

export interface DbBlock {
  block_hash: string;
  index_block_hash: string;
  parent_block_hash: string;
  parent_microblock: string;
  block_height: number;
  /** Set to `true` if entry corresponds to the canonical chain tip */
  canonical: boolean;
}

export enum DbTxTypeId {
  TokenTransfer = 0x00,
  SmartContract = 0x01,
  ContractCall = 0x02,
  PoisonMicroblock = 0x03,
  Coinbase = 0x04,
}

export enum DbTxStatus {
  Pending = 0,
  Success = 1,
  Failed = -1,
}

export interface DbTx {
  // TODO: a truncated 128-bit tx_id should be used as a postgres guid for the primary key and all relational columns
  tx_id: string;
  tx_index: number;
  block_hash: string;
  block_height: number;
  type_id: DbTxTypeId;
  status: number;
  /** Set to `true` if entry corresponds to the canonical chain tip */
  canonical: boolean;
  post_conditions?: Buffer;
  /** u64 */
  fee_rate: BigInt;
  sender_address: string;
  /** u8 */
  origin_hash_mode: number;
  sponsored: boolean;
}

export interface DbSmartContract {
  tx_id: string;
  contract_id: string;
  block_height: number;
  source_code: string;
  canonical: boolean;
}

export interface DbEvent {
  // /** The first 128 bits of sha256(uint32BE(event_index) + tx_id) */
  // event_id: string;
  event_index: number;
  tx_id: string;
  block_height: number;
  /** Set to `true` if entry corresponds to the canonical chain tip */
  canonical: boolean;
}

export interface DbSmartContractEventTypeId extends DbEvent {
  contract_identifier: string;
  topic: string;
  value: Buffer;
}

export enum DbAssetEventTypeId {
  Transfer = 1,
  Mint = 2,
  Burn = 3,
}

export interface DbAssetEvent extends DbEvent {
  asset_event_type_id: DbAssetEventTypeId;
  sender?: string;
  recipient?: string;
}

export interface DbStxEvent extends DbAssetEvent {
  amount: BigInt;
}

export interface DbContractAssetEvent extends DbAssetEvent {
  asset_identifier: string;
}

export interface DbFtEvent extends DbContractAssetEvent {
  /** unsigned 128-bit integer */
  amount: BigInt;
}

export interface DbNftEvent extends DbContractAssetEvent {
  /** Raw Clarity value */
  value: Buffer;
}

export interface DataStore {
  updateBlock(block: DbBlock): Promise<void>;
  getBlock(blockHash: string): Promise<DbBlock>;

  updateTx(tx: DbTx): Promise<void>;
  getTx(txId: string): Promise<DbTx>;
  getTxList(count?: number): Promise<{ results: DbTx[] }>;

  updateStxEvent(event: DbStxEvent): Promise<void>;
  updateFtEvent(event: DbFtEvent): Promise<void>;
  updateNftEvent(event: DbNftEvent): Promise<void>;
  updateSmartContractEvent(event: DbSmartContractEventTypeId): Promise<void>;

  updateSmartContract(smartContract: DbSmartContract): Promise<void>;
}

export function getAssetEventId(event_index: number, event_tx_id: string): string {
  const buff = Buffer.alloc(4 + 32);
  buff.writeUInt32BE(event_index, 0);
  hexToBuffer(event_tx_id).copy(buff, 4);
  const hashed = crypto.createHash('sha256').update(buff).digest().slice(16).toString('hex');
  return '0x' + hashed;
}
