# Exact Integration Webhook Payloads

This document describes the expected JSON payloads for webhooks between the production app and Exact Online via Zapier.

## Base Webhook URL

All inbound webhooks should be sent to:
```
POST https://ybmtjbnrslczpgjdaxry.supabase.co/functions/v1/webhook-receiver
```

### Authentication

Include the webhook secret in the `X-Webhook-Secret` header for authentication.

---

## Inbound Actions (Exact → App)

### 1. `sync_products` - Sync Products/Items from Exact

Synchronizes the product catalog from Exact to the app's `products` table.

**Payload:**
```json
{
  "action": "sync_products",
  "products": [
    {
      "exact_item_id": "abc123-uuid-from-exact",
      "item_code": "SDM-ECO-001",
      "name": "SDM ECO Sensor Unit",
      "name_nl": "SDM ECO Sensor Eenheid",
      "description": "High-precision density measurement sensor",
      "product_type": "SDM_ECO",
      "is_active": true
    },
    {
      "exact_item_id": "def456-uuid-from-exact",
      "item_code": "SENSOR-TMP-002",
      "name": "Temperature Sensor Module",
      "name_nl": "Temperatuursensor Module",
      "description": "Industrial temperature sensor",
      "product_type": "SENSOR",
      "is_active": true
    }
  ]
}
```

**Field Descriptions:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `exact_item_id` | string | ✅ | Unique identifier from Exact Online |
| `item_code` | string | ✅ | Product/Item code in Exact |
| `name` | string | ✅ | English product name |
| `name_nl` | string | ❌ | Dutch product name |
| `description` | string | ❌ | Product description |
| `product_type` | enum | ✅ | One of: `SDM_ECO`, `SENSOR`, `MLA`, `HMI`, `TRANSMITTER` |
| `is_active` | boolean | ❌ | Whether product is active (default: true) |

**Response:**
```json
{
  "success": true,
  "message": "Synced 2 products",
  "synced_count": 2
}
```

---

### 2. `sync_exact_work_order` - Create/Update Shop Order from Exact

Creates or updates a shop order when created in Exact, including materials information.

**Payload:**
```json
{
  "action": "sync_exact_work_order",
  "exact_shop_order_number": "SO-2024-001234",
  "exact_shop_order_link": "https://start.exactonline.nl/docs/ShopOrderView.aspx?ID=abc123",
  "wo_number": "PENDING-1703347200000",
  "product": {
    "exact_item_id": "abc123-uuid-from-exact",
    "item_code": "SDM-ECO-001"
  },
  "batch_size": 10,
  "customer": {
    "exact_customer_id": "cust-001",
    "name": "Acme Corporation"
  },
  "planned_start_date": "2024-01-15",
  "planned_end_date": "2024-01-20",
  "materials_summary": {
    "projected_stock": 100,
    "in_stock": 85,
    "shortage": 15,
    "items": [
      {
        "material_code": "MAT-001",
        "material_name": "Transducer Unit",
        "required_qty": 10,
        "available_qty": 8,
        "status": "partial"
      },
      {
        "material_code": "MAT-002",
        "material_name": "Housing Assembly",
        "required_qty": 10,
        "available_qty": 10,
        "status": "complete"
      }
    ]
  },
  "materials_issued_status": "pending",
  "notes": "Priority order for Q1 delivery"
}
```

**Field Descriptions:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `exact_shop_order_number` | string | ✅ | Shop Order number from Exact |
| `exact_shop_order_link` | string | ✅ | Direct link to order in Exact |
| `wo_number` | string | ❌ | App's WO number (for matching pending orders) |
| `product.exact_item_id` | string | ✅ | Product ID from Exact |
| `product.item_code` | string | ✅ | Product code |
| `batch_size` | number | ✅ | Quantity to produce |
| `customer.exact_customer_id` | string | ❌ | Customer ID from Exact |
| `customer.name` | string | ❌ | Customer name |
| `planned_start_date` | string | ❌ | ISO date (YYYY-MM-DD) |
| `planned_end_date` | string | ❌ | ISO date (YYYY-MM-DD) |
| `materials_summary` | object | ❌ | Materials availability summary |
| `materials_issued_status` | enum | ❌ | `pending`, `partial`, or `complete` |
| `notes` | string | ❌ | Order notes |

**`materials_issued_status` Values:**
- `pending` - Materials not yet picked/issued
- `partial` - Some materials issued, awaiting remainder
- `complete` - All materials issued and ready for production

**Response:**
```json
{
  "success": true,
  "message": "Shop order synced",
  "work_order_id": "uuid-of-work-order",
  "exact_shop_order_number": "SO-2024-001234"
}
```

---

### 3. `assign_batch_numbers` - Assign Batch Numbers to Items

Called when materials are issued in Exact with specific batch numbers for each production item.

**Payload:**
```json
{
  "action": "assign_batch_numbers",
  "work_order_id": "uuid-of-work-order",
  "exact_shop_order_number": "SO-2024-001234",
  "materials_issued_status": "complete",
  "batch_assignments": [
    {
      "position_in_batch": 1,
      "serial_number": "SDM-2024-0001",
      "batch_number": "BATCH-2024-001",
      "materials": [
        {
          "material_code": "MAT-001",
          "batch_number": "MAT-BATCH-A1"
        }
      ]
    },
    {
      "position_in_batch": 2,
      "serial_number": "SDM-2024-0002",
      "batch_number": "BATCH-2024-001",
      "materials": [
        {
          "material_code": "MAT-001",
          "batch_number": "MAT-BATCH-A1"
        }
      ]
    },
    {
      "position_in_batch": 3,
      "serial_number": "SDM-2024-0003",
      "batch_number": "BATCH-2024-002",
      "materials": [
        {
          "material_code": "MAT-001",
          "batch_number": "MAT-BATCH-A2"
        }
      ]
    }
  ]
}
```

**Field Descriptions:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `work_order_id` | string | ❌ | App's work order UUID (use this OR exact_shop_order_number) |
| `exact_shop_order_number` | string | ❌ | Exact's shop order number (alternative identifier) |
| `materials_issued_status` | enum | ✅ | New status: `pending`, `partial`, or `complete` |
| `batch_assignments` | array | ✅ | Array of item assignments |
| `batch_assignments[].position_in_batch` | number | ✅ | Item position (1-based) |
| `batch_assignments[].serial_number` | string | ❌ | Item serial number |
| `batch_assignments[].batch_number` | string | ✅ | Production batch number |
| `batch_assignments[].materials` | array | ❌ | Materials with their batch numbers |

**Response:**
```json
{
  "success": true,
  "message": "Assigned batch numbers to 3 items",
  "updated_items": 3,
  "materials_issued_status": "complete"
}
```

---

### 4. `sync_customers` - Sync Customers from Exact

Synchronizes customer data from Exact to the app's `customers` table.

**Payload:**
```json
{
  "action": "sync_customers",
  "customers": [
    {
      "exact_customer_id": "cust-001-uuid",
      "name": "Acme Corporation",
      "name_nl": "Acme Bedrijf",
      "email": "orders@acme.com",
      "phone": "+31 20 123 4567",
      "address": {
        "street": "123 Industrial Way",
        "city": "Amsterdam",
        "postal_code": "1012 AB",
        "country": "Netherlands"
      },
      "is_active": true
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Synced 1 customers",
  "synced_count": 1
}
```

---

## Outbound Events (App → Exact via Zapier)

### 1. `shopOrder.create.requested`

Fired when a new shop order is created in the app and needs to be created in Exact.

**Payload sent to Zapier webhook:**
```json
{
  "event": "shopOrder.create.requested",
  "timestamp": "2024-01-10T14:30:00.000Z",
  "data": {
    "work_order_id": "uuid-of-work-order",
    "wo_number": "PENDING-1703347200000",
    "product": {
      "exact_item_id": "abc123-uuid",
      "item_code": "SDM-ECO-001",
      "name": "SDM ECO Sensor Unit"
    },
    "batch_size": 10,
    "planned_start_date": "2024-01-15",
    "planned_end_date": "2024-01-20",
    "notes": "Rush order"
  }
}
```

**Expected Zapier Response Action:**
Zapier should call `sync_exact_work_order` with the created shop order details from Exact.

---

### 2. `shopOrder.completion.requested`

Fired when all production items are completed and the order should be marked complete in Exact.

**Payload sent to Zapier webhook:**
```json
{
  "event": "shopOrder.completion.requested",
  "timestamp": "2024-01-20T16:45:00.000Z",
  "data": {
    "work_order_id": "uuid-of-work-order",
    "exact_shop_order_number": "SO-2024-001234",
    "completed_items": 10,
    "completion_date": "2024-01-20T16:45:00.000Z",
    "items": [
      {
        "serial_number": "SDM-2024-0001",
        "batch_number": "BATCH-2024-001",
        "completed_at": "2024-01-20T14:30:00.000Z"
      }
    ]
  }
}
```

---

## Status Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    SHOP ORDER LIFECYCLE                      │
└─────────────────────────────────────────────────────────────┘

App Creates Order              Exact Creates Order
       │                              │
       ▼                              ▼
┌──────────────┐              ┌──────────────┐
│   PENDING    │◄────────────►│ sync_exact_  │
│  (no SO#)    │              │ work_order   │
└──────────────┘              └──────────────┘
       │                              │
       └──────────┬───────────────────┘
                  ▼
         ┌──────────────┐
         │   PLANNED    │  materials_issued_status: pending
         │  (has SO#)   │
         └──────────────┘
                  │
                  ▼ (Materials picked in Exact)
         ┌──────────────┐
         │   PARTIAL    │  materials_issued_status: partial
         │  MATERIALS   │
         └──────────────┘
                  │
                  ▼ (All materials issued)
         ┌──────────────┐
         │   READY      │  materials_issued_status: complete
         │   TO START   │  → Notify Anton/Erwin
         └──────────────┘
                  │
                  ▼ (Production dates set)
         ┌──────────────┐
         │ IN PROGRESS  │  → Notify production team
         └──────────────┘
                  │
                  ▼ (All items complete)
         ┌──────────────┐
         │  COMPLETED   │  → Request Exact completion
         └──────────────┘
```

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "code": "ERROR_CODE"
}
```

**Common Error Codes:**
- `INVALID_ACTION` - Unknown action type
- `MISSING_REQUIRED_FIELD` - Required field not provided
- `WORK_ORDER_NOT_FOUND` - Referenced work order doesn't exist
- `PRODUCT_NOT_FOUND` - Referenced product doesn't exist
- `INVALID_STATUS` - Invalid status value provided

---

## Testing Webhooks

Use the app's webhook testing feature to send test payloads and verify your Zapier integration is working correctly.

1. Go to Settings → Integrations → Incoming Webhooks
2. Create or select a webhook
3. Use "Test Webhook" to send sample payloads
4. Check the logs to verify processing
