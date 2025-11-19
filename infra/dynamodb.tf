# DynamoDB table for calendar, songs, and date locks
resource "aws_dynamodb_table" "calendar" {
  name           = local.table_name
  billing_mode   = "PAY_PER_REQUEST" # On-demand pricing for low traffic
  hash_key       = "PK"              # Partition key
  stream_enabled = false

  attribute {
    name = "PK"
    type = "S" # String type for date (YYYY-MM-DD) or lock keys
  }

  # TTL for automatic cleanup of expired date locks
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  # Point-in-time recovery for data protection
  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name        = "${local.resource_prefix}-calendar"
    Description = "Calendar table for songs and metadata"
  }
}

# Example item structure:
# Song Entry:
# {
#   "PK": "SONG#2025-11-06",
#   "songTitle": "Wake Me Up",
#   "youtubeURL": "https://youtube.com/...",
#   "s3SongKey": "songs/2025-11-06/uuid.mp3",
#   "thumbnailS3Key": "thumbnails/2025-11-06/uuid.jpg",
#   "djName": "Alice",
#   "djType": "recorded",
#   "s3DJKey": "dj-messages/2025-11-06/uuid.mp3",
#   "djMessage": "Optional TTS message",
#   "friendEmail": "alice@example.com",
#   "submittedBy": "cookie-uuid",
#   "createdAt": 1699257600
# }
#
# Lock Entry:
# {
#   "PK": "LOCK#2025-11-06",
#   "lockHolder": "cookie-uuid",
#   "expiresAt": 1699258500 (15 minutes from creation)
# }
