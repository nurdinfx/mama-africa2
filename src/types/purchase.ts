export interface Product {
  _id: string;
  sku: string;
  name: string;
  unit: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  minStock: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Supplier {
  _id: string;
  name: string;
  contact: {
    phone: string;
    email: string;
  };
  address: string;
  paymentTerms: string;
  bankDetails?: {
    accountNumber: string;
    bankName: string;
    ifscCode: string;
  };
  rating: number;
  balance: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseItem {
  productId: string;
  qty: number;
  unitCost: number;
  discount: number;
  tax: number;
  total: number;
  expirationDate?: string;
  batchNumber?: string;
  product?: Product;
  _id?: string;
}

export interface Purchase {
  _id: string;
  supplierId: string;
  items: PurchaseItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  status: 'draft' | 'submitted' | 'paid' | 'cancelled';
  paymentMethod?: 'cash' | 'credit' | 'bank';
  createdBy: string;
  receivedAt?: string;
  attachments: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  supplier?: Supplier;
}

export interface POItem {
  _id: string;
  productId: string;
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
  total: number;
  product?: Product;
}

export interface PurchaseOrder {
  _id: string;
  supplierId: string;
  items: POItem[];
  expectedDelivery: string;
  status: 'draft' | 'pending' | 'approved' | 'received' | 'cancelled';
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  supplier?: Supplier;
}

export interface DashboardStats {
  totalPurchases: number;
  totalAmount: number;
  pendingPOs: number;
  lowStockItems: number;
  recentPurchases: Purchase[];
  topSuppliers: { supplier: Supplier; total: number }[];
}