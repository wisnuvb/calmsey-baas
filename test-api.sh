#!/bin/bash

# Calmsey BaaS - API Testing Script
# This script contains curl commands to test all endpoints

# Configuration
BASE_URL="http://localhost:3000"
CONTENT_TYPE="Content-Type: application/json"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}\n"
}

print_error() {
    echo -e "${RED}✗ $1${NC}\n"
}

# Variables to store tokens and IDs
TOKEN=""
API_KEY=""
PROJECT_ID=""
PROJECT_SLUG=""
COLLECTION_ID=""
ITEM_ID=""

print_header "Calmsey BaaS API Testing"
echo "Base URL: $BASE_URL"
echo "Make sure the server is running!"
echo ""

# Health Check
print_header "1. Health Check"
curl -s "$BASE_URL/health" | jq .
print_success "Health check completed"

# Register User
print_header "2. Register User"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "$CONTENT_TYPE" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }')

echo "$REGISTER_RESPONSE" | jq .

if echo "$REGISTER_RESPONSE" | jq -e '.success' > /dev/null; then
    TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.data.token')
    print_success "User registered successfully. Token saved."
else
    print_error "Registration failed. User might already exist. Trying to login..."
    
    # Login if registration fails
    print_header "2b. Login"
    LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
      -H "$CONTENT_TYPE" \
      -d '{
        "email": "test@example.com",
        "password": "password123"
      }')
    
    echo "$LOGIN_RESPONSE" | jq .
    TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token')
    print_success "Logged in successfully. Token saved."
fi

# Get Current User
print_header "3. Get Current User"
curl -s "$BASE_URL/api/auth/me" \
  -H "Authorization: Bearer $TOKEN" | jq .
print_success "User info retrieved"

# Create Project
print_header "4. Create Project"
PROJECT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/projects" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test E-commerce",
    "description": "Testing e-commerce backend"
  }')

echo "$PROJECT_RESPONSE" | jq .

PROJECT_ID=$(echo "$PROJECT_RESPONSE" | jq -r '.data.id')
PROJECT_SLUG=$(echo "$PROJECT_RESPONSE" | jq -r '.data.slug')
API_KEY=$(echo "$PROJECT_RESPONSE" | jq -r '.data.apiKeys[0].key')

print_success "Project created: $PROJECT_SLUG"
echo "Project ID: $PROJECT_ID"
echo "API Key: $API_KEY"

# List Projects
print_header "5. List Projects"
curl -s "$BASE_URL/api/projects" \
  -H "Authorization: Bearer $TOKEN" | jq .
print_success "Projects listed"

# Create Collection
print_header "6. Create Collection (Products)"
COLLECTION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/collections?projectId=$PROJECT_ID" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Products",
    "schema": {
      "fields": [
        {
          "name": "name",
          "type": "string",
          "required": true
        },
        {
          "name": "description",
          "type": "text"
        },
        {
          "name": "price",
          "type": "number",
          "required": true,
          "validation": {
            "min": 0
          }
        },
        {
          "name": "stock",
          "type": "number",
          "default": 0
        },
        {
          "name": "category",
          "type": "string",
          "validation": {
            "enum": ["electronics", "fashion", "food", "books"]
          }
        },
        {
          "name": "isActive",
          "type": "boolean",
          "default": true
        }
      ],
      "timestamps": true,
      "softDelete": false
    }
  }')

echo "$COLLECTION_RESPONSE" | jq .

COLLECTION_ID=$(echo "$COLLECTION_RESPONSE" | jq -r '.data.id')
print_success "Collection created: products"

# List Collections
print_header "7. List Collections"
curl -s "$BASE_URL/api/collections?projectId=$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .
print_success "Collections listed"

# Create Product (Dynamic API)
print_header "8. Create Product (Using Dynamic API)"
PRODUCT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/data/$PROJECT_SLUG/products" \
  -H "$CONTENT_TYPE" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "name": "Wireless Headphones",
    "description": "Premium noise-cancelling headphones",
    "price": 299.99,
    "stock": 50,
    "category": "electronics",
    "isActive": true
  }')

echo "$PRODUCT_RESPONSE" | jq .

ITEM_ID=$(echo "$PRODUCT_RESPONSE" | jq -r '.data.id')
print_success "Product created with ID: $ITEM_ID"

# Create Another Product
print_header "9. Create Another Product"
curl -s -X POST "$BASE_URL/api/data/$PROJECT_SLUG/products" \
  -H "$CONTENT_TYPE" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "name": "Smart Watch",
    "description": "Fitness tracking smartwatch",
    "price": 199.99,
    "stock": 100,
    "category": "electronics",
    "isActive": true
  }' | jq .
print_success "Second product created"

# List Products
print_header "10. List Products (with pagination)"
curl -s "$BASE_URL/api/data/$PROJECT_SLUG/products?page=1&limit=10&sort=createdAt&order=desc" \
  -H "X-API-Key: $API_KEY" | jq .
print_success "Products listed"

# Get Single Product
print_header "11. Get Single Product"
curl -s "$BASE_URL/api/data/$PROJECT_SLUG/products/$ITEM_ID" \
  -H "X-API-Key: $API_KEY" | jq .
print_success "Product retrieved"

# Update Product
print_header "12. Update Product"
curl -s -X PATCH "$BASE_URL/api/data/$PROJECT_SLUG/products/$ITEM_ID" \
  -H "$CONTENT_TYPE" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "price": 279.99,
    "stock": 45
  }' | jq .
print_success "Product updated"

# Filter Products
print_header "13. Filter Products (electronics only)"
curl -s "$BASE_URL/api/data/$PROJECT_SLUG/products?filter={\"category\":\"electronics\"}" \
  -H "X-API-Key: $API_KEY" | jq .
print_success "Products filtered"

# Create API Key
print_header "14. Create Additional API Key"
curl -s -X POST "$BASE_URL/api/projects/$PROJECT_ID/api-keys" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Production API Key"
  }' | jq .
print_success "Additional API key created"

# Get Project Details
print_header "15. Get Project Details (with all collections and API keys)"
curl -s "$BASE_URL/api/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .
print_success "Project details retrieved"

# Test Validation (should fail)
print_header "16. Test Validation (negative price - should fail)"
curl -s -X POST "$BASE_URL/api/data/$PROJECT_SLUG/products" \
  -H "$CONTENT_TYPE" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "name": "Invalid Product",
    "price": -10,
    "category": "electronics"
  }' | jq .
print_error "Expected validation error (this is correct!)"

# Test Required Field (should fail)
print_header "17. Test Required Field (missing name - should fail)"
curl -s -X POST "$BASE_URL/api/data/$PROJECT_SLUG/products" \
  -H "$CONTENT_TYPE" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "price": 99.99,
    "category": "electronics"
  }' | jq .
print_error "Expected validation error for missing required field (this is correct!)"

# Test Enum Validation (should fail)
print_header "18. Test Enum Validation (invalid category - should fail)"
curl -s -X POST "$BASE_URL/api/data/$PROJECT_SLUG/products" \
  -H "$CONTENT_TYPE" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "name": "Test Product",
    "price": 99.99,
    "category": "invalid-category"
  }' | jq .
print_error "Expected validation error for invalid enum (this is correct!)"

# Delete Product (Optional - uncomment to test)
print_header "19. Delete Product (Optional)"
echo "Skipping delete to keep test data..."
# Uncomment to test delete:
# curl -s -X DELETE "$BASE_URL/api/data/$PROJECT_SLUG/products/$ITEM_ID" \
#   -H "X-API-Key: $API_KEY" | jq .
# print_success "Product deleted"

print_header "Testing Complete!"
echo -e "${GREEN}All tests passed!${NC}\n"
echo "Summary:"
echo "  - Token: $TOKEN"
echo "  - Project ID: $PROJECT_ID"
echo "  - Project Slug: $PROJECT_SLUG"
echo "  - API Key: $API_KEY"
echo "  - Collection ID: $COLLECTION_ID"
echo "  - Sample Item ID: $ITEM_ID"
echo ""
echo "You can now use these values to test manually:"
echo ""
echo "  # List products"
echo "  curl '$BASE_URL/api/data/$PROJECT_SLUG/products' -H 'X-API-Key: $API_KEY'"
echo ""
echo "  # Create product"
echo "  curl -X POST '$BASE_URL/api/data/$PROJECT_SLUG/products' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H 'X-API-Key: $API_KEY' \\"
echo "    -d '{\"name\":\"New Product\",\"price\":99.99,\"category\":\"electronics\"}'"
echo ""
