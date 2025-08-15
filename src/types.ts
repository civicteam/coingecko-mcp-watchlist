/**
 * Data Models for Crypto Watchlist MCP Server
 * Based on SPEC.md requirements
 */

// ============================================================================
// CORE DATA MODELS
// ============================================================================

export interface User {
  id: string;           // From Civic Auth
  email: string;        // From Civic Auth
  createdAt: Date;
  updatedAt: Date;
}

export interface Watchlist {
  id: string;
  userId: string;       // Owner's Civic Auth ID
  name: string;
  description?: string;
  isPublic: boolean;    // Private by default
  coins: WatchlistCoin[];
  notes?: WatchlistNote[];
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];      // For categorization
}

export interface WatchlistCoin {
  id: string;
  watchlistId: string;
  coinId: string;       // CoinGecko coin ID
  symbol: string;       // e.g., "BTC", "ETH"
  name: string;         // e.g., "Bitcoin", "Ethereum"
  addedAt: Date;
  targetPrice?: number; // Optional price alert target
  notes?: string;       // User notes about this coin
}

export interface WatchlistNote {
  id: string;
  watchlistId: string;
  coinId?: string;      // Optional - can be general watchlist note
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// DATABASE SCHEMA
// ============================================================================

export interface DatabaseSchema {
  users: Map<string, User>;              // Key: userId
  watchlists: Map<string, Watchlist>;    // Key: watchlistId
  watchlistCoins: Map<string, WatchlistCoin[]>; // Key: watchlistId
  notes: Map<string, WatchlistNote>;     // Key: noteId
  
  // Indexes for efficient queries
  userWatchlists: Map<string, string[]>; // Key: userId, Value: watchlistIds
  publicWatchlists: Set<string>;         // Set of public watchlist IDs
  coinWatchlists: Map<string, string[]>; // Key: coinId, Value: watchlistIds
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export type ErrorCode = 'UNAUTHORIZED' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'FORBIDDEN' | 'RATE_LIMITED' | 'INTERNAL_ERROR';

export interface ErrorResponse {
  error: string;
  code: ErrorCode;
  message: string;
  details?: any;
}

export class WatchlistError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'WatchlistError';
  }
}

// ============================================================================
// MCP TOOL PARAMETERS & RESPONSES
// ============================================================================

// Watchlist Management Parameters
export interface CreateWatchlistParams {
  name: string;
  description?: string;
  isPublic?: boolean;
  tags?: string[];
}

export interface UpdateWatchlistParams {
  watchlistId: string;
  name?: string;
  description?: string;
  isPublic?: boolean;
  tags?: string[];
}

export interface GetPublicWatchlistsParams {
  page?: number;
  limit?: number;
  search?: string;
  tags?: string[];
}

// Coin Management Parameters
export interface AddCoinToWatchlistParams {
  watchlistId: string;
  coinId: string;
  targetPrice?: number;
  notes?: string;
}

export interface UpdateCoinInWatchlistParams {
  watchlistId: string;
  coinId: string;
  targetPrice?: number;
  notes?: string;
}

// Notes Management Parameters
export interface AddWatchlistNoteParams {
  watchlistId: string;
  coinId?: string;
  content: string;
}

export interface UpdateNoteParams {
  noteId: string;
  content: string;
}

// Market Data Parameters
export interface GetWatchlistWithPricesParams {
  watchlistId: string;
  vsCurrency?: string;
  includePriceChange?: boolean;
}

export interface SearchCoinsParams {
  query: string;
}

export interface GetCoinDetailsParams {
  coinId: string;
  includePriceData?: boolean;
  includeMarketData?: boolean;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface WatchlistWithPrices extends Omit<Watchlist, 'coins'> {
  coins: (WatchlistCoin & {
    currentPrice?: number;
    priceChange24h?: number;
    priceChangePercentage24h?: number;
    marketCap?: number;
    volume24h?: number;
  })[];
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type CreateEntity<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateEntity<T> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;

// Validation limits (as per SPEC.md)
export const VALIDATION_LIMITS = {
  MAX_COINS_PER_WATCHLIST: 100,
  MAX_NOTE_LENGTH: 1000,
  MAX_WATCHLIST_NAME_LENGTH: 100,
  MAX_WATCHLIST_DESCRIPTION_LENGTH: 500,
  MAX_TAGS_PER_WATCHLIST: 10,
  MAX_TAG_LENGTH: 50,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// Cache TTL values (in milliseconds)
export const CACHE_TTL = {
  PRICE_DATA: 2 * 60 * 1000,        // 2 minutes
  COIN_METADATA: 30 * 60 * 1000,    // 30 minutes
  TRENDING_DATA: 10 * 60 * 1000,    // 10 minutes
  SEARCH_RESULTS: 5 * 60 * 1000,    // 5 minutes
} as const;
