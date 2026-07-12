// WearIt cloud backup Lambda
// Routes (via API Gateway HTTP API, Lambda proxy integration):
//   PUT /backup   — save wardrobe/wishlist/savedOutfits JSON to DynamoDB, return presigned S3 PUT URLs for photos
//   GET /backup?deviceId=...  — read metadata from DynamoDB, return presigned S3 GET URLs for photos
//
// Env vars required: TABLE_NAME, BUCKET_NAME

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const TABLE_NAME = process.env.TABLE_NAME || 'wearit-backups'
const BUCKET_NAME = process.env.BUCKET_NAME

const ddbClient = new DynamoDBClient({})
const ddb = DynamoDBDocumentClient.from(ddbClient)
const s3 = new S3Client({})

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    body: JSON.stringify(body),
  }
}

export const handler = async (event) => {
  // Support both HTTP API (v2, event.requestContext.http.method) and REST API (v1, event.httpMethod)
  const method = event.requestContext?.http?.method || event.httpMethod

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  }

  try {
    if (method === 'PUT') return await handlePut(event)
    if (method === 'GET') return await handleGet(event)
    return json(405, { error: 'Method not allowed' })
  } catch (err) {
    console.error('Backup lambda error:', err)
    return json(500, { error: 'Internal error' })
  }
}

async function handlePut(event) {
  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  const { deviceId, wardrobe, wishlist, savedOutfits, photoKeys } = body

  if (!deviceId || typeof deviceId !== 'string') {
    return json(400, { error: 'deviceId is required' })
  }

  await ddb.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      deviceId,
      wardrobe: JSON.stringify(wardrobe || []),
      wishlist: JSON.stringify(wishlist || []),
      savedOutfits: JSON.stringify(savedOutfits || []),
      updatedAt: new Date().toISOString(),
    },
  }))

  // Hand back a presigned PUT URL for every photo the client wants to upload this round.
  // Client uploads directly to S3 — photo bytes never pass through this Lambda or API Gateway.
  const uploadUrls = {}
  for (const key of photoKeys || []) {
    uploadUrls[key] = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, ContentType: 'image/jpeg' }),
      { expiresIn: 300 }
    )
  }

  return json(200, { ok: true, uploadUrls })
}

async function handleGet(event) {
  const deviceId = event.queryStringParameters?.deviceId
  if (!deviceId) {
    return json(400, { error: 'deviceId is required' })
  }

  const result = await ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: { deviceId } }))
  if (!result.Item) {
    return json(404, { error: 'No backup found for this device' })
  }

  const listed = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET_NAME, Prefix: `${deviceId}/` }))

  const photos = {}
  for (const obj of listed.Contents || []) {
    photos[obj.Key] = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: obj.Key }),
      { expiresIn: 300 }
    )
  }

  return json(200, {
    wardrobe: JSON.parse(result.Item.wardrobe || '[]'),
    wishlist: JSON.parse(result.Item.wishlist || '[]'),
    savedOutfits: JSON.parse(result.Item.savedOutfits || '[]'),
    updatedAt: result.Item.updatedAt,
    photos,
  })
}
