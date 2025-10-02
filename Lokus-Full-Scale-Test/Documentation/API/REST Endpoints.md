# 🔌 REST API Endpoints Documentation

Comprehensive API documentation for the [[E-commerce Platform]] and related services.

## 🏢 Base Configuration

**Base URL**: `https://api.example.com/v1`  
**Authentication**: Bearer Token  
**Content-Type**: `application/json`

## 👤 User Management

### Authentication Endpoints

| Method | Endpoint | Description | Links |
|--------|----------|-------------|-------|
| POST | `/auth/login` | User login | [[Authentication Flow]] |
| POST | `/auth/register` | User registration | [[User Registration]] |
| POST | `/auth/refresh` | Token refresh | [[JWT Management]] |
| POST | `/auth/logout` | User logout | [[Session Management]] |

#### Login Example
```javascript
// POST /auth/login
{
  "email": "user@example.com",
  "password": "securePassword123"
}

// Response
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

## 🛍️ Product Management

### Product Endpoints

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| GET | `/products` | List products | Public |
| GET | `/products/:id` | Get product | Public |
| POST | `/products` | Create product | Admin |
| PUT | `/products/:id` | Update product | Admin |
| DELETE | `/products/:id` | Delete product | Admin |

#### Product Schema
```json
{
  "id": "prod_123",
  "name": "Wireless Headphones",
  "description": "High-quality wireless headphones...",
  "price": 199.99,
  "currency": "USD",
  "category": "electronics",
  "stock": 50,
  "images": [
    "https://cdn.example.com/headphones1.jpg",
    "https://cdn.example.com/headphones2.jpg"
  ],
  "specifications": {
    "battery": "30 hours",
    "connectivity": "Bluetooth 5.0",
    "weight": "250g"
  },
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

### Advanced Queries

Query parameters for `/products`:

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `category` | string | Filter by category | `?category=electronics` |
| `min_price` | number | Minimum price | `?min_price=50` |
| `max_price` | number | Maximum price | `?max_price=500` |
| `search` | string | Text search | `?search=wireless` |
| `sort` | string | Sort field | `?sort=price_desc` |
| `limit` | number | Results limit | `?limit=20` |
| `offset` | number | Results offset | `?offset=40` |

## 🛒 Cart & Orders

### Shopping Cart

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| GET | `/cart` | Get user cart | - |
| POST | `/cart/items` | Add item | `{productId, quantity}` |
| PUT | `/cart/items/:id` | Update quantity | `{quantity}` |
| DELETE | `/cart/items/:id` | Remove item | - |
| DELETE | `/cart` | Clear cart | - |

### Order Processing

```javascript
// POST /orders
{
  "items": [
    {
      "productId": "prod_123",
      "quantity": 2,
      "price": 199.99
    }
  ],
  "shippingAddress": {
    "street": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zipCode": "94102",
    "country": "USA"
  },
  "paymentMethod": "stripe_pm_123"
}
```

## 📊 Analytics & Reporting

### Metrics Endpoints

| Endpoint | Description | Access Level |
|----------|-------------|--------------|
| `/analytics/sales` | Sales metrics | Admin |
| `/analytics/products` | Product performance | Admin |
| `/analytics/users` | User statistics | Admin |

#### Sales Analytics
```json
{
  "period": "2024-01",
  "totalRevenue": 125000.50,
  "totalOrders": 423,
  "averageOrderValue": 295.49,
  "topProducts": [
    {
      "productId": "prod_123",
      "name": "Wireless Headphones",
      "sales": 89,
      "revenue": 17791.11
    }
  ]
}
```

## 🔍 Search & Filtering

### Search Implementation

Mathematical relevance scoring:
$$
\text{score} = \alpha \cdot \text{title\_match} + \beta \cdot \text{description\_match} + \gamma \cdot \text{popularity}
$$

Where:
- $\alpha = 0.6$ (title weight)
- $\beta = 0.3$ (description weight)  
- $\gamma = 0.1$ (popularity weight)

### Elasticsearch Integration
```javascript
// Advanced search with [[Elasticsearch]] integration
const searchQuery = {
  query: {
    bool: {
      must: [
        {
          multi_match: {
            query: searchTerm,
            fields: ["name^2", "description", "category"]
          }
        }
      ],
      filter: [
        { range: { price: { gte: minPrice, lte: maxPrice } } },
        { term: { category: categoryFilter } }
      ]
    }
  }
};
```

## ⚡ Performance Optimization

### Caching Strategy

| Endpoint | Cache TTL | Strategy |
|----------|-----------|----------|
| `/products` | 15 min | Redis |
| `/categories` | 1 hour | Memory |
| `/products/:id` | 30 min | CDN + Redis |

### Rate Limiting

```javascript
// Rate limiting configuration
const rateLimiter = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP"
};
```

## 🔐 Security

### Input Validation
```javascript
const productSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(1000),
  price: Joi.number().positive().precision(2).required(),
  category: Joi.string().valid('electronics', 'clothing', 'books')
});
```

### Authentication Middleware
```javascript
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};
```

## 📋 Error Handling

### Standard Error Responses

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ],
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_abc123"
  }
}
```

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PUT |
| 201 | Created | Successful POST |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

## 🔗 Related Documentation

- [[Projects/Web-Apps/E-commerce Platform]] - Main project
- [[Documentation/Technical/Database Schema]] - Data models
- [[Research/Backend/API Design Patterns]] - Design principles
- [[Examples/Code/API Testing]] - Testing examples
- [[Tutorials/JavaScript/Express.js]] - Backend framework

---

**API Version**: v1.0 | **Last Updated**: January 2024 | **Team**: Backend