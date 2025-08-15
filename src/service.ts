/**
 * Service Layer for Crypto Watchlist MCP Server
 * Integrates with Civic Auth and provides business logic
 */


import { database } from './database.js';
import {
  User,
  Watchlist,
  WatchlistCoin,
  WatchlistNote,
  WatchlistError,
  CreateWatchlistParams,
  UpdateWatchlistParams,
  GetPublicWatchlistsParams,
  AddCoinToWatchlistParams,
  UpdateCoinInWatchlistParams,
  AddWatchlistNoteParams,
  UpdateNoteParams,
  PaginatedResponse,
  VALIDATION_LIMITS
} from './types.js';

// ============================================================================
// USER MANAGEMENT (SIMPLIFIED - NO STORAGE)
// ============================================================================

// Users are managed entirely through Civic Auth - no storage needed

// ============================================================================
// WATCHLIST MANAGEMENT
// ============================================================================

export const createWatchlist = (userId: string, params: CreateWatchlistParams): Watchlist => {
  // Simple validation
  if (!params.name?.trim()) {
    throw new WatchlistError('VALIDATION_ERROR', 'Watchlist name is required');
  }

  return database.createWatchlist(userId, {
    name: params.name.trim(),
    description: params.description?.trim(),
    isPublic: params.isPublic || false,
    tags: params.tags || [],
  });
};

export const getMyWatchlists = (userId: string): Watchlist[] => {
  return database.getUserWatchlists(userId);
};

export const getWatchlist = (watchlistId: string, userId?: string): Watchlist => {
  return database.getWatchlist(watchlistId, userId);
};

export const updateWatchlist = (watchlistId: string, userId: string, params: UpdateWatchlistParams): Watchlist => {
  const updates: any = {};
  if (params.name !== undefined) updates.name = params.name.trim();
  if (params.description !== undefined) updates.description = params.description?.trim();
  if (params.isPublic !== undefined) updates.isPublic = params.isPublic;
  if (params.tags !== undefined) updates.tags = params.tags;

  return database.updateWatchlist(watchlistId, userId, updates);
};

export const deleteWatchlist = (watchlistId: string, userId: string): void => {
  database.deleteWatchlist(watchlistId, userId);
};

export const getPublicWatchlists = (params: GetPublicWatchlistsParams): PaginatedResponse<Watchlist> => {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(VALIDATION_LIMITS.MAX_PAGE_SIZE, Math.max(1, params.limit || VALIDATION_LIMITS.DEFAULT_PAGE_SIZE));

  const result = database.getPublicWatchlists({
    page,
    limit,
    search: params.search?.trim(),
    tags: params.tags?.map(tag => tag.trim()).filter(tag => tag.length > 0),
  });

  return {
    data: result.watchlists,
    page: result.page,
    limit: result.limit,
    total: result.total,
    hasNext: page * limit < result.total,
    hasPrevious: page > 1,
  };
};

// ============================================================================
// COIN MANAGEMENT
// ============================================================================

export const addCoinToWatchlist = (watchlistId: string, userId: string, params: AddCoinToWatchlistParams): WatchlistCoin => {
  // Simple validation
  if (!params.coinId?.trim()) {
    throw new WatchlistError('VALIDATION_ERROR', 'Coin ID is required');
  }

  return database.addCoinToWatchlist(watchlistId, userId, {
    watchlistId,
    coinId: params.coinId.trim(),
    symbol: params.symbol?.trim() || params.coinId.toUpperCase(),
    name: params.name?.trim() || params.coinId,
    targetPrice: params.targetPrice,
    notes: params.notes?.trim(),
  });
};

export const removeCoinFromWatchlist = (watchlistId: string, userId: string, coinId: string): void => {
  database.removeCoinFromWatchlist(watchlistId, userId, coinId.trim());
};

export const updateCoinInWatchlist = (watchlistId: string, userId: string, params: UpdateCoinInWatchlistParams): WatchlistCoin => {
  const updates: any = {};
  if (params.targetPrice !== undefined) updates.targetPrice = params.targetPrice;
  if (params.notes !== undefined) updates.notes = params.notes?.trim();

  return database.updateCoinInWatchlist(watchlistId, userId, params.coinId.trim(), updates);
};

// ============================================================================
// NOTES MANAGEMENT
// ============================================================================

export const addWatchlistNote = (watchlistId: string, userId: string, params: AddWatchlistNoteParams): WatchlistNote => {
  if (!params.content?.trim()) {
    throw new WatchlistError('VALIDATION_ERROR', 'Note content is required');
  }

  return database.addNote(watchlistId, userId, params.content.trim(), params.coinId?.trim());
};

export const getWatchlistNotes = (watchlistId: string, userId: string, coinId?: string): WatchlistNote[] => {
  return database.getWatchlistNotes(watchlistId, userId, coinId?.trim());
};

export const updateNote = (noteId: string, userId: string, params: UpdateNoteParams): WatchlistNote => {
  if (!params.content?.trim()) {
    throw new WatchlistError('VALIDATION_ERROR', 'Note content is required');
  }

  return database.updateNote(noteId, userId, params.content.trim());
};

export const deleteNote = (noteId: string, userId: string): void => {
  database.deleteNote(noteId, userId);
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const getDatabaseStats = () => {
  return database.getStats();
};

export const clearExpiredCache = () => {
  database.clearExpiredCache();
};

// ============================================================================
// LEGACY TODO FUNCTIONS (for backward compatibility during transition)
// ============================================================================

export const getTodos = (username: string): string[] => {
  // Return empty array for legacy compatibility
  return [];
};

export const createTodo = (username: string, todo: string): string => {
  // Legacy function - no longer used
  return todo;
};

export const deleteTodo = (username: string, index: number): boolean => {
  // Legacy function - no longer used
  return false;
};