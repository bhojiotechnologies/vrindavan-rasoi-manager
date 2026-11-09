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
  stockMovements: "stockMovements",
  wastage: "wastage",
  cashClosings: "cashClosings",
  activityLogs: "activityLogs",
  settings: "settings",
  backups: "backups",
} as const;

export type UserRole = "owner" | "staff";

export type AccountStatus = "active" | "inactive";

export interface UserProfile {
  uid: string;
  name: string;
  role: UserRole;
  status: AccountStatus;
  username?: string;
  createdAt: number;
}

export interface Item {
  id: string;
  name: string;
  category: string;
  unit: string;
  rate: number;
  stock: number;
  lowStockLimit: number;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  address?: string;
  advanceBalance: number;
  createdAt: number;
}

export interface Supplier {
  id: string;
  name: string;
  mobile: string;
  address?: string;
  createdAt: number;
}

export type PaymentMode = "cash" | "upi";

export interface SaleItem {
  itemId: string;
  itemName: string;
  quantity: number;
  rate: number;
  total: number;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  customerId?: string;
  customerName?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMode: PaymentMode;
  createdBy: string;
  createdAt: number;
  status: "active" | "void";
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  paymentMode: PaymentMode;
  note?: string;
  createdBy: string;
  createdAt: number;
}

export interface Purchase {
  id: string;
  supplierId: string;
  total: number;
  paidAmount: number;
  paymentMode: PaymentMode;
  createdBy: string;
  createdAt: number;
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  module: string;
  recordId?: string;
  createdAt: number;
}

