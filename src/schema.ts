export const COLLECTIONS = {
  users: "users",
  items: "items",
  customers: "customers",
  sales: "sales",
  expenses: "expenses",
  suppliers: "suppliers",
  purchases: "purchases",
  supplierPayments: "supplierPayments",
  customerPayments: "customerPayments",
  advanceTransactions: "advanceTransactions",
  stockMovements: "stockMovements",
  wastage: "wastage",
  cashTransactions: "cashTransactions",
  cashClosings: "cashClosings",
  activityLogs: "activityLogs",
  settings: "settings",
  backups: "backups",
  invoiceCounters: "invoiceCounters",
} as const;

export type UserRole = "owner" | "staff";
export type AccountStatus = "active" | "inactive";
export type PaymentMode = "cash" | "upi";
export type RecordStatus = "active" | "void";
export type TransactionStatus = "pending" | "completed" | "cancelled";

export interface BaseRecord {
  id: string;
  createdAt: number;
  updatedAt?: number;
  createdBy: string;
  updatedBy?: string;
  status?: RecordStatus;
}

export interface UserProfile {
  uid: string;
  name: string;
  role: UserRole;
  status: AccountStatus;
  username?: string;
  email?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface Item extends BaseRecord {
  name: string;
  category: string;
  unit: string;
  rate: number;
  stock: number;
  lowStockLimit: number;
  active: boolean;
}

export interface Customer extends BaseRecord {
  name: string;
  mobile: string;
  address?: string;
  advanceBalance: number;
  totalPurchases: number;
  totalPayments: number;
}

export interface Supplier extends BaseRecord {
  name: string;
  mobile: string;
  address?: string;
  totalPurchases: number;
  totalPaid: number;
  outstandingBalance: number;
}

export interface SaleItem {
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  rate: number;
  total: number;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  customerId?: string;
  customerName?: string;
  customerMobile?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  cashAmount: number;
  upiAmount: number;
  advanceUsed: number;
  paymentMode: PaymentMode | "split";
  createdBy: string;
  createdAt: number;
  updatedAt?: number;
  updatedBy?: string;
  status: RecordStatus;
}

export interface Expense extends BaseRecord {
  title: string;
  category: string;
  amount: number;
  paymentMode: PaymentMode;
  note?: string;
  date: number;
}

export interface PurchaseItem {
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  rate: number;
  total: number;
}

export interface Purchase extends BaseRecord {
  supplierId: string;
  supplierName: string;
  invoiceNumber?: string;
  items: PurchaseItem[];
  subtotal: number;
  total: number;
  paidAmount: number;
  outstandingAmount: number;
  paymentMode: PaymentMode;
  date: number;
}

export interface SupplierPayment extends BaseRecord {
  supplierId: string;
  supplierName: string;
  purchaseId?: string;
  amount: number;
  paymentMode: PaymentMode;
  note?: string;
  date: number;
}

export interface CustomerPayment extends BaseRecord {
  customerId: string;
  customerName: string;
  amount: number;
  paymentMode: PaymentMode;
  note?: string;
  date: number;
}

export interface AdvanceTransaction extends BaseRecord {
  customerId: string;
  customerName: string;
  type: "deposit" | "adjustment" | "refund";
  amount: number;
  paymentMode?: PaymentMode;
  saleId?: string;
  note?: string;
  date: number;
}

export interface StockMovement extends BaseRecord {
  itemId: string;
  itemName: string;
  type: "purchase" | "sale" | "wastage" | "adjustment";
  quantity: number;
  previousStock: number;
  newStock: number;
  referenceId?: string;
  note?: string;
}

export interface Wastage extends BaseRecord {
  itemId: string;
  itemName: string;
  quantity: number;
  estimatedLoss: number;
  reason: string;
  photoUrl?: string;
  date: number;
}

export interface CashTransaction extends BaseRecord {
  type: "opening" | "cashIn" | "cashOut" | "sale" | "expense" | "refund";
  amount: number;
  paymentMode: PaymentMode;
  referenceId?: string;
  note?: string;
  date: number;
}

export interface CashClosing extends BaseRecord {
  date: string;
  openingCash: number;
  cashSales: number;
  cashIn: number;
  cashOut: number;
  cashExpenses: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
  upiCollection: number;
  closedBy: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  role: UserRole;
  action: string;
  module: string;
  recordId?: string;
  details?: string;
  createdAt: number;
}

export interface BusinessSettings {
  businessName: string;
  tagline: string;
  address: string;
  phone: string;
  gstNumber?: string;
  upiQrUrl?: string;
  updatedAt: number;
  updatedBy: string;
}

export interface InvoiceCounter {
  id: string;
  year: number;
  lastNumber: number;
  updatedAt: number;
}
