export enum EntityType {
  Order = 'order',
  Customer = 'customer',
  Product = 'product',
  Fulfillment = 'fulfillment',
  Refund = 'refund',
  Collection = 'collection',
}

export enum ImportStatus {
  Received = 'received',
  Processing = 'processing',
  Processed = 'processed',
  Failed = 'failed',
  BulkImported = 'bulk_imported',
}

export enum ExportStatus {
  Pending = 'pending',
  Processing = 'processing',
  Exported = 'exported',
  Failed = 'failed',
}
