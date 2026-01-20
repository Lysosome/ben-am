# Admin Controls

Administrative interface for managing the Ben AM calendar.

## Overview

The admin controls page provides calendar management capabilities accessible at `/admin`. This interface allows administrators to:

- Block dates to prevent user submissions
- Unblock previously blocked dates
- Move songs to different dates
- Delete songs from the calendar

## Access

Navigate to `https://your-domain.com/admin` (or `http://localhost:5173/admin` in development).

**Note**: Currently there is no authentication. In production, you should add authentication (e.g., Cognito, API keys, or IP whitelisting) to protect the `/admin/*` endpoints.

## Features

### Block Date

Marks a date as unavailable by creating a placeholder entry in DynamoDB with:
- `songTitle: '[BLOCKED]'`
- `processingStatus: 'blocked'`
- `blockedReason: <optional reason>`

**Use cases:**
- Holidays
- Special events
- Maintenance periods

**Restrictions:**
- Cannot block dates that already have songs
- Only future dates can be blocked

### Unblock Date

Removes a blocked placeholder entry to make the date available for submissions again.

**Restrictions:**
- Only works on blocked dates (not real songs)
- Cannot unblock dates with real songs (use Delete instead)

### Move Song

Transfers a song from one date to another available date. This operation:

1. Validates source date has a song
2. Validates target date is available
3. Copies all S3 assets to new date-prefixed keys:
   - Song MP3 (`songs/YYYY-MM-DD/`)
   - Combined audio (`combined/YYYY-MM-DD/`)
   - Thumbnail (`thumbnails/YYYY-MM-DD/`)
   - DJ recording (`dj-messages/YYYY-MM-DD/`)
4. Creates new DynamoDB entry with updated date
5. Deletes old S3 assets
6. Deletes old DynamoDB entry

**Use cases:**
- Rescheduling due to conflicts
- Friend requests to change date
- Date corrections

**Restrictions:**
- Source date must have a real song (not blocked)
- Target date must be available
- Only future dates can be moved
- Cannot move blocked placeholder entries

### Delete Song

Permanently removes a song and all associated files:
- Deletes S3 objects (song, combined, thumbnail, DJ recording)
- Removes DynamoDB entry
- Cannot be undone

**Use cases:**
- Inappropriate content
- User requests
- Duplicate submissions

**Restrictions:**
- Only future dates can be deleted
- All S3 deletions use `Promise.allSettled` to continue even if some files are missing

## Implementation Details

### Backend

**File**: `backend/api/src/handlers/admin.ts`

Exports a single handler that routes to:
- `blockDate()` - POST `/admin/block-date`
- `unblockDate()` - DELETE `/admin/unblock-date`
- `moveSong()` - PUT `/admin/move-song`
- `deleteSong()` - DELETE `/admin/delete-song`

All functions include:
- Input validation (date format, existence checks)
- Error handling with proper HTTP status codes
- CloudWatch logging

### Frontend

**File**: `frontend/src/pages/AdminPage.tsx`

Features:
- Real-time calendar data fetching
- Separate sections for available and occupied dates
- Confirmation dialogs for all operations
- Success/error notifications via Snackbar
- Material UI components for consistent styling

**API Client**: `frontend/src/api/client.ts` exports `adminApi` with typed functions.

### Infrastructure

**File**: `infra/api-gateway.tf`

Defines API Gateway resources for:
- `/admin/block-date` (POST)
- `/admin/unblock-date` (DELETE)
- `/admin/move-song` (PUT)
- `/admin/delete-song` (DELETE)

All routes include CORS OPTIONS methods.

**File**: `backend/api/src/index.ts` routes requests starting with `/admin/` to the admin handler.

## Security Considerations

### Current State

⚠️ **No authentication is currently implemented**. Anyone with the URL can access admin controls.

### Recommended Security Measures

1. **API Gateway Authorization**
   - Add API keys to admin routes
   - Use AWS IAM authorization
   - Implement JWT token validation

2. **Cognito Integration**
   - Create admin user pool
   - Protect frontend admin route
   - Require login for admin operations

3. **IP Whitelisting**
   - Restrict admin endpoints to known IPs
   - Use AWS WAF for additional protection

4. **Audit Logging**
   - Log all admin operations to CloudWatch
   - Send notifications on admin actions
   - Store operation history in DynamoDB

Example Terraform for API key protection:

```hcl
resource "aws_api_gateway_api_key" "admin" {
  name = "admin-api-key"
}

resource "aws_api_gateway_method" "post_admin_block_date" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.admin_block_date.id
  http_method   = "POST"
  authorization = "NONE"
  api_key_required = true  # Add this
}
```

## Deployment

### Backend

1. Build API Lambda:
```bash
cd backend/api
npm install
npm run build
```

2. Deploy infrastructure:
```bash
cd infra
terraform apply
```

The API Lambda automatically includes the admin handler.

### Frontend

1. Build frontend:
```bash
cd frontend
npm install
npm run build
```

2. Deploy to S3:
```bash
aws s3 sync dist/ s3://ben-am-frontend-bucket --delete
aws cloudfront create-invalidation --distribution-id YOUR_ID --paths "/*"
```

The admin page is automatically included in the build.

## Testing

### Local Development

1. Start backend (SAM):
```bash
sam local start-api --template-file template.yaml
```

2. Start frontend:
```bash
cd frontend
npm run dev
```

3. Navigate to `http://localhost:5173/admin`

### Manual API Testing

```bash
# Block a date
curl -X POST http://localhost:3000/admin/block-date \
  -H "Content-Type: application/json" \
  -d '{"date": "2026-01-25", "reason": "Testing"}'

# Unblock a date
curl -X DELETE http://localhost:3000/admin/unblock-date \
  -H "Content-Type: application/json" \
  -d '{"date": "2026-01-25"}'

# Move a song
curl -X PUT http://localhost:3000/admin/move-song \
  -H "Content-Type: application/json" \
  -d '{"fromDate": "2026-01-25", "toDate": "2026-01-26"}'

# Delete a song
curl -X DELETE http://localhost:3000/admin/delete-song \
  -H "Content-Type: application/json" \
  -d '{"date": "2026-01-25"}'
```

## Troubleshooting

### "Date already has a song" when blocking

The date already has a song submitted. Delete the song first, then block the date.

### "Target date already has a song" when moving

The destination date is occupied. Choose a different target date or delete the existing song first.

### S3 copy/delete errors

Check Lambda IAM permissions include:
- `s3:GetObject`
- `s3:PutObject`
- `s3:CopyObject`
- `s3:DeleteObject`

### DynamoDB permission errors

Ensure Lambda role has:
- `dynamodb:GetItem`
- `dynamodb:PutItem`
- `dynamodb:DeleteItem`

## Future Enhancements

- [ ] Authentication and authorization
- [ ] Audit log viewer
- [ ] Bulk operations (block multiple dates)
- [ ] Song preview before deletion
- [ ] Undo functionality with history
- [ ] Export calendar data
- [ ] Statistics and analytics
