/**
 * In-Memory Database for Crypto Watchlist MCP Server
 * Based on SPEC.md database schema requirements
 */

import {
  User,
  Watchlist,
  WatchlistCoin,
  WatchlistNote,
  WatchlistError,
  CreateWatchlistParams,
  GetPublicWatchlistsParams,
  AddCoinToWatchlistParams,
  DatabaseStats,
  VALIDATION_LIMITS
} from './types.js';

// ============================================================================
// IN-MEMORY DATABASE SCHEMA
// ============================================================================

interface DatabaseSchema {
  users: Map<string, User>;              // Key: userId
  watchlists: Map<string, Watchlist>;    // Key: watchlistId
  watchlistCoins: Map<string, WatchlistCoin[]>; // Key: watchlistId
  notes: Map<string, WatchlistNote>;     // Key: noteId
  
  // Indexes for efficient queries
  userWatchlists: Map<string, string[]>; // Key: userId, Value: watchlistIds
  publicWatchlists: Set<string>;         // Set of public watchlist IDs
  coinWatchlists: Map<string, string[]>; // Key: coinId, Value: watchlistIds
}

class InMemoryDatabase {
  private db: DatabaseSchema;
  private idCounter = 1;

  constructor() {
    this.db = {
      users: new Map(),
      watchlists: new Map(),
      watchlistCoins: new Map(),
      notes: new Map(),
      userWatchlists: new Map(),
      publicWatchlists: new Set(),
      coinWatchlists: new Map(),
    };
  }

  private generateId(): string {
    return `id_${Date.now()}_${this.idCounter++}`;
  }

  // ============================================================================
  // WATCHLIST OPERATIONS
  // ============================================================================

  createWatchlist(userId: string, params: CreateWatchlistParams): Watchlist {
    const id = this.generateId();
    const now = new Date();
    
    const watchlist: Watchlist = {
      id,
      userId,
      name: params.name,
      description: params.description,
      isPublic: params.isPublic || false,
      coins: [],
      notes: [],
      createdAt: now,
      updatedAt: now,
      tags: params.tags || [],
    };

    // Store watchlist
    this.db.watchlists.set(id, watchlist);
    this.db.watchlistCoins.set(id, []);

    // Update indexes
    const userWatchlists = this.db.userWatchlists.get(userId) || [];
    userWatchlists.push(id);
    this.db.userWatchlists.set(userId, userWatchlists);

    if (watchlist.isPublic) {
      this.db.publicWatchlists.add(id);
    }

    return watchlist;
  }

  getUserWatchlists(userId: string): Watchlist[] {
    const watchlistIds = this.db.userWatchlists.get(userId) || [];
    return watchlistIds
      .map(id => this.db.watchlists.get(id))
      .filter((w): w is Watchlist => w !== undefined)
      .map(w => this.enrichWatchlistWithCoins(w));
  }

  getWatchlist(watchlistId: string, userId?: string): Watchlist {
    const watchlist = this.db.watchlists.get(watchlistId);
    
    if (!watchlist) {
      throw new WatchlistError('NOT_FOUND', 'Watchlist not found');
    }

    // Check access permissions
    if (userId && watchlist.userId !== userId && !watchlist.isPublic) {
      throw new WatchlistError('FORBIDDEN', 'Access denied to private watchlist');
    }

    return this.enrichWatchlistWithCoins(watchlist);
  }

  updateWatchlist(watchlistId: string, userId: string, updates: Partial<Watchlist>): Watchlist {
    const watchlist = this.db.watchlists.get(watchlistId);
    
    if (!watchlist) {
      throw new WatchlistError('NOT_FOUND', 'Watchlist not found');
    }

    if (watchlist.userId !== userId) {
      throw new WatchlistError('FORBIDDEN', 'Cannot update another user\'s watchlist');
    }

    // Update fields
    const updatedWatchlist = {
      ...watchlist,
      ...updates,
      updatedAt: new Date(),
    };

    this.db.watchlists.set(watchlistId, updatedWatchlist);

    // Update public index if visibility changed
    if (updates.isPublic !== undefined) {
      if (updates.isPublic) {
        this.db.publicWatchlists.add(watchlistId);
      } else {
        this.db.publicWatchlists.delete(watchlistId);
      }
    }

    return this.enrichWatchlistWithCoins(updatedWatchlist);
  }

  deleteWatchlist(watchlistId: string, userId: string): void {
    const watchlist = this.db.watchlists.get(watchlistId);
    
    if (!watchlist) {
      throw new WatchlistError('NOT_FOUND', 'Watchlist not found');
    }

    if (watchlist.userId !== userId) {
      throw new WatchlistError('FORBIDDEN', 'Cannot delete another user\'s watchlist');
    }

    // Remove from all indexes
    this.db.watchlists.delete(watchlistId);
    this.db.watchlistCoins.delete(watchlistId);
    this.db.publicWatchlists.delete(watchlistId);

    // Update user watchlists index
    const userWatchlists = this.db.userWatchlists.get(userId) || [];
    this.db.userWatchlists.set(userId, userWatchlists.filter(id => id !== watchlistId));

    // Remove associated notes
    for (const [noteId, note] of this.db.notes.entries()) {
      if (note.watchlistId === watchlistId) {
        this.db.notes.delete(noteId);
      }
    }
  }

  getPublicWatchlists(params: GetPublicWatchlistsParams) {
    const page = params.page || 1;
    const limit = params.limit || VALIDATION_LIMITS.DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * limit;

    let watchlists = Array.from(this.db.publicWatchlists)
      .map(id => this.db.watchlists.get(id))
      .filter((w): w is Watchlist => w !== undefined)
      .map(w => this.enrichWatchlistWithCoins(w));

    // Apply search filter
    if (params.search) {
      const searchTerm = params.search.toLowerCase();
      watchlists = watchlists.filter(w => 
        w.name.toLowerCase().includes(searchTerm) ||
        w.description?.toLowerCase().includes(searchTerm)
      );
    }

    // Apply tags filter
    if (params.tags && params.tags.length > 0) {
      watchlists = watchlists.filter(w => 
        params.tags!.some(tag => w.tags?.includes(tag))
      );
    }

    const total = watchlists.length;
    const paginatedWatchlists = watchlists.slice(offset, offset + limit);

    return {
      watchlists: paginatedWatchlists,
      page,
      limit,
      total,
    };
  }

  // ============================================================================
  // COIN OPERATIONS
  // ============================================================================

  addCoinToWatchlist(watchlistId: string, userId: string, params: AddCoinToWatchlistParams): WatchlistCoin {
    const watchlist = this.getWatchlist(watchlistId, userId);
    
    if (watchlist.userId !== userId) {
      throw new WatchlistError('FORBIDDEN', 'Cannot modify another user\'s watchlist');
    }

    const coins = this.db.watchlistCoins.get(watchlistId) || [];
    
    // Check if coin already exists
    if (coins.some(coin => coin.coinId === params.coinId)) {
      throw new WatchlistError('VALIDATION_ERROR', 'Coin already exists in watchlist');
    }

    const coin: WatchlistCoin = {
      id: this.generateId(),
      watchlistId,
      coinId: params.coinId,
      symbol: params.symbol || params.coinId.toUpperCase(),
      name: params.name || params.coinId,
      addedAt: new Date(),
      targetPrice: params.targetPrice,
      notes: params.notes,
    };

    coins.push(coin);
    this.db.watchlistCoins.set(watchlistId, coins);

    // Update coin index
    const coinWatchlists = this.db.coinWatchlists.get(params.coinId) || [];
    coinWatchlists.push(watchlistId);
    this.db.coinWatchlists.set(params.coinId, coinWatchlists);

    return coin;
  }

  removeCoinFromWatchlist(watchlistId: string, userId: string, coinId: string): void {
    const watchlist = this.getWatchlist(watchlistId, userId);
    
    if (watchlist.userId !== userId) {
      throw new WatchlistError('FORBIDDEN', 'Cannot modify another user\'s watchlist');
    }

    const coins = this.db.watchlistCoins.get(watchlistId) || [];
    const filteredCoins = coins.filter(coin => coin.coinId !== coinId);
    
    if (filteredCoins.length === coins.length) {
      throw new WatchlistError('NOT_FOUND', 'Coin not found in watchlist');
    }

    this.db.watchlistCoins.set(watchlistId, filteredCoins);

    // Update coin index
    const coinWatchlists = this.db.coinWatchlists.get(coinId) || [];
    this.db.coinWatchlists.set(coinId, coinWatchlists.filter(id => id !== watchlistId));
  }

  updateCoinInWatchlist(watchlistId: string, userId: string, coinId: string, updates: Partial<WatchlistCoin>): WatchlistCoin {
    const watchlist = this.getWatchlist(watchlistId, userId);
    
    if (watchlist.userId !== userId) {
      throw new WatchlistError('FORBIDDEN', 'Cannot modify another user\'s watchlist');
    }

    const coins = this.db.watchlistCoins.get(watchlistId) || [];
    const coinIndex = coins.findIndex(coin => coin.coinId === coinId);
    
    if (coinIndex === -1) {
      throw new WatchlistError('NOT_FOUND', 'Coin not found in watchlist');
    }

    const updatedCoin = { ...coins[coinIndex], ...updates };
    coins[coinIndex] = updatedCoin;
    this.db.watchlistCoins.set(watchlistId, coins);

    return updatedCoin;
  }

  // ============================================================================
  // NOTES OPERATIONS
  // ============================================================================

  addNote(watchlistId: string, userId: string, content: string, coinId?: string): WatchlistNote {
    const watchlist = this.getWatchlist(watchlistId, userId);
    
    if (watchlist.userId !== userId) {
      throw new WatchlistError('FORBIDDEN', 'Cannot add notes to another user\'s watchlist');
    }

    const note: WatchlistNote = {
      id: this.generateId(),
      watchlistId,
      coinId,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.db.notes.set(note.id, note);
    return note;
  }

  getWatchlistNotes(watchlistId: string, userId: string, coinId?: string): WatchlistNote[] {
    const watchlist = this.getWatchlist(watchlistId, userId);
    
    if (watchlist.userId !== userId && !watchlist.isPublic) {
      throw new WatchlistError('FORBIDDEN', 'Cannot view notes from private watchlist');
    }

    const allNotes = Array.from(this.db.notes.values());
    return allNotes.filter(note => {
      if (note.watchlistId !== watchlistId) return false;
      if (coinId && note.coinId !== coinId) return false;
      return true;
    });
  }

  updateNote(noteId: string, userId: string, content: string): WatchlistNote {
    const note = this.db.notes.get(noteId);
    
    if (!note) {
      throw new WatchlistError('NOT_FOUND', 'Note not found');
    }

    const watchlist = this.getWatchlist(note.watchlistId, userId);
    
    if (watchlist.userId !== userId) {
      throw new WatchlistError('FORBIDDEN', 'Cannot update notes from another user\'s watchlist');
    }

    const updatedNote = {
      ...note,
      content,
      updatedAt: new Date(),
    };

    this.db.notes.set(noteId, updatedNote);
    return updatedNote;
  }

  deleteNote(noteId: string, userId: string): void {
    const note = this.db.notes.get(noteId);
    
    if (!note) {
      throw new WatchlistError('NOT_FOUND', 'Note not found');
    }

    const watchlist = this.getWatchlist(note.watchlistId, userId);
    
    if (watchlist.userId !== userId) {
      throw new WatchlistError('FORBIDDEN', 'Cannot delete notes from another user\'s watchlist');
    }

    this.db.notes.delete(noteId);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private enrichWatchlistWithCoins(watchlist: Watchlist): Watchlist {
    const coins = this.db.watchlistCoins.get(watchlist.id) || [];
    const notes = this.getNotesForWatchlist(watchlist.id);
    
    return {
      ...watchlist,
      coins,
      notes,
    };
  }

  private getNotesForWatchlist(watchlistId: string, coinId?: string): WatchlistNote[] {
    const allNotes = Array.from(this.db.notes.values());
    return allNotes.filter(note => {
      if (note.watchlistId !== watchlistId) return false;
      if (coinId && note.coinId !== coinId) return false;
      return true;
    });
  }

  getStats(): DatabaseStats {
    return {
      watchlistsCount: this.db.watchlists.size,
      coinsCount: Array.from(this.db.watchlistCoins.values()).reduce((sum, coins) => sum + coins.length, 0),
      notesCount: this.db.notes.size,
      publicWatchlistsCount: this.db.publicWatchlists.size,
      usersCount: this.db.userWatchlists.size,
    };
  }

  clearExpiredCache(): void {
    // No cache expiration logic in this simple implementation
    console.log('Cache cleared (no-op in memory database)');
  }

  // Development helpers
  reset(): void {
    this.db.users.clear();
    this.db.watchlists.clear();
    this.db.watchlistCoins.clear();
    this.db.notes.clear();
    this.db.userWatchlists.clear();
    this.db.publicWatchlists.clear();
    this.db.coinWatchlists.clear();
    this.idCounter = 1;
  }
}

// Export singleton instance
export const database = new InMemoryDatabase();
