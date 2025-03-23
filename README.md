# Custom Media Service

A NodeJS application providing a media management service with a custom HTTP server that integrates with AWS S3 for storage.

## Features

- Efficient file uploads using AWS S3 presigned URLs
- Complete media lifecycle management (upload, download, delete)
- Metadata storage with MongoDB
- Filter media by status
- Robust error handling with standardized responses
- Structured logging
- Docker support for easy deployment
- Health check endpoint
- Page-based pagination for easy navigation through large collections

## Architecture

The application follows a modular architecture organized by feature:

- **common**: Shared utilities, configuration, error handling, and logging
- **media**: Media-specific functionality including storage interfaces, services, and controllers
- **server**: HTTP server, routing, and middleware

The application uses a multi-step approach for file uploads:
1. Client requests a presigned URL
2. Client uploads directly to S3 using the presigned URL
3. Client notifies the server of upload completion
4. Server verifies and updates the file status

Data persistence is handled through:
1. **S3 Storage**: For the actual media files
2. **MongoDB**: For storing and querying file metadata

## Setup

### Prerequisites

- Node.js v22.14.0 (Volta will handle the correct version)
- AWS account with S3 access configured
- MongoDB (local, Docker, or cloud-based)

### Quick Setup

The project includes a setup script that will install Volta (if needed) and configure your development environment:

```bash
# Clone the repository
git clone <repository-url>
cd media-service

# Run the setup script
./setup.sh
```

This will:
1. Install Volta if it's not already installed
2. Set up the correct Node.js (v22.14.0) and npm (v10.9.2) versions
3. Install project dependencies
4. Build the project

### Environment Configuration

Copy the example environment file and customize it:

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration:

```
# Server Configuration
PORT=3000
NODE_ENV=development

# AWS S3 Configuration
AWS_REGION=eu-central-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
S3_BUCKET_NAME=your-media-bucket

# Upload Configuration
MAX_FILE_SIZE=104857600  # 100MB in bytes
UPLOAD_URL_EXPIRY=900    # 15 minutes in seconds

# Validation
ALLOWED_MIME_TYPES=image/jpeg,image/png,image/gif,application/pdf,video/mp4

# MongoDB Configuration
MONGODB_URI=mongodb+srv://
MONGODB_DB_NAME=media_service

# Logging
LOG_LEVEL=info          # debug, info, warn, error
```

### Running with Docker

You can run the application with Docker and docker-compose:

```bash
# Create and configure your .env file first
cp .env.example .env
# Edit .env with your configuration

# Build and start the services (app + MongoDB)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the services
docker-compose down
```

Or use the setup script with the --docker flag:

```bash
./setup.sh --docker
```

### Manual Installation

If you prefer to set up manually:

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

For development with hot-reloading:

```bash
npm run dev
```

## API Documentation

### Upload Flow

#### 1. Request a Presigned URL

```
POST /api/v1/media/upload-request
```

Request body:
```json
{
  "fileName": "example.jpg",
  "mimeType": "image/jpeg",
  "size": 1024000
}
```

Response:
```json
{
  "success": true,
  "data": {
    "uploadId": "550e8400-e29b-41d4-a716-446655440000",
    "url": "https://your-bucket.s3.amazonaws.com/...",
    "expires": 1633456789000
  }
}
```

#### 2. Upload to S3

Use the presigned URL to upload the file directly to S3 (from the client).

Example with cURL:
```bash
curl -X PUT "PRESIGNED_URL" \
  -H "Content-Type: image/jpeg" \
  --data-binary "@/path/to/your/file.jpg"
```

#### 3. Complete the Upload

```
POST /api/v1/media/upload-complete
```

Request body:
```json
{
  "uploadId": "550e8400-e29b-41d4-a716-446655440000"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "originalName": "example.jpg",
    "mimeType": "image/jpeg",
    "size": 1024000,
    "status": "uploaded",
    "uploadedAt": "2023-10-15T12:30:45.000Z"
  }
}
```

### Media Operations

#### List All Media Files

```
GET /api/v1/media
```

Optional query parameters:
- `status`: Filter by status (e.g., "pending", "uploaded")
- `mimeType`: Filter by MIME type
- `fileName`: Search by file name (case-insensitive, partial match)
- `startDate`: Filter by upload date (ISO format, inclusive)
- `endDate`: Filter by upload date (ISO format, inclusive)
- `minSize`: Filter by minimum file size in bytes
- `maxSize`: Filter by maximum file size in bytes
- `includeUrls`: Set to "true" to include download URLs in the response

Pagination parameters:
- `page`: Page number to retrieve (default: 1)
- `limit`: Number of items per page (default: 20, max: 100)
- `sortBy`: Field to sort by (default: "createdAt")
- `sortOrder`: Sort direction, "asc" or "desc" (default: "desc")

Response:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "originalName": "example.jpg",
        "mimeType": "image/jpeg",
        "size": 1024000,
        "status": "uploaded",
        "uploadedAt": "2023-10-15T12:30:45.000Z"
      },
      // More items...
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 95,
      "limit": 20,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
```

To navigate through pages, use the `nextCursor` value as the `cursor` parameter in your next request.

#### Get File Metadata

```
GET /api/v1/media/:id
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "originalName": "example.jpg",
    "mimeType": "image/jpeg",
    "size": 1024000,
    "status": "uploaded",
    "uploadedAt": "2023-10-15T12:30:45.000Z",
    "url": "https://your-bucket.s3.amazonaws.com/..."
  }
}
```

#### Update File

```
PUT /api/v1/media/:id
```

Request body:
```json
{
  "fileName": "updated-example.jpg",
  "mimeType": "image/jpeg",
  "size": 1536000
}
```

Response:
```json
{
  "success": true,
  "data": {
    "uploadId": "550e8400-e29b-41d4-a716-446655440000",
    "url": "https://your-bucket.s3.amazonaws.com/...",
    "expires": 1633456789000
  }
}
```

After receiving the presigned URL, you need to upload the file directly to S3 and then complete the upload using the upload-complete endpoint, just like in the initial upload flow.

#### Get Download URL

```
GET /api/v1/media/:id/download
```

Response:
```json
{
  "success": true,
  "data": {
    "url": "https://your-bucket.s3.amazonaws.com/...",
    "fileId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### Delete File

```
DELETE /api/v1/media/:id
```

Response:
```json
{
  "success": true,
  "data": {
    "deleted": true,
    "fileId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### Health Check

```
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2023-10-15T12:30:45.000Z"
}
```

## Postman Collection

A Postman collection is available in the `examples` directory for testing the API endpoints. Import the `Media Service.postman_collection.json` file into Postman to get started.

You will need to set up a Postman environment variable called `baseUrl` (typically `http://localhost:3000`).

## Error Handling

The API returns standardized error responses:

```json
{
  "success": false,
  "error": {
    "message": "Error message",
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

Common error codes:
- `VALIDATION_ERROR`: Invalid request parameters
- `NOT_FOUND`: Resource not found
- `STORAGE_ERROR`: Error interacting with storage
- `INTERNAL_ERROR`: Unexpected server error

## License

ISC 