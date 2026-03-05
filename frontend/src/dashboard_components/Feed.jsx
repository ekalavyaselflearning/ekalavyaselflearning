import React, { useState, useEffect, useCallback } from 'react';
import './Feed.css';
import { auth, db } from '../firebase.js';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';

// Category config — maps UI tabs to GNews search queries
const CATEGORIES = [
  { id: 'top',        label: 'Top Stories',    icon: 'fa-fire',          query: 'india'                              },
  { id: 'govt',       label: 'Government',     icon: 'fa-landmark',      query: 'india government policy scheme'     },
  { id: 'judiciary',  label: 'SC & Courts',    icon: 'fa-gavel',         query: 'supreme court india verdict'        },
  { id: 'economy',    label: 'Economy',        icon: 'fa-chart-line',    query: 'india economy budget rbi gdp'       },
  { id: 'world',      label: 'International',  icon: 'fa-globe',         query: 'india foreign policy international' },
  { id: 'science',    label: 'Science & Tech', icon: 'fa-flask',         query: 'india science technology isro'      },
];

// UPSC relevance keywords — articles matching these get a badge
const UPSC_KEYWORDS = [
  'supreme court', 'parliament', 'constitution', 'policy', 'scheme', 'ministry',
  'rbi', 'budget', 'gdp', 'isro', 'election', 'bill', 'act', 'government',
  'cabinet', 'president', 'prime minister', 'lok sabha', 'rajya sabha',
  'tribunal', 'verdict', 'judgement', 'international', 'treaty', 'un',
];

function isUpscRelevant(article) {
  const text = `${article.title} ${article.description}`.toLowerCase();
  return UPSC_KEYWORDS.some(kw => text.includes(kw));
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60)   return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)    return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Stable doc ID from article URL (base64-like, Firestore-safe)
function articleDocId(url) {
  return btoa(url).replace(/[^a-zA-Z0-9]/g, '').slice(0, 60);
}

// ── Single article card ────────────────────────────────────────────────
function ArticleCard({ article, index, isSaved, onToggleSave, saving }) {
  const relevant = isUpscRelevant(article);
  const [imgError, setImgError] = useState(false);

  function handleCheckbox(e) {
    e.preventDefault();    // don't open the link
    e.stopPropagation();
    onToggleSave(article);
  }

  return (
    <a
      className={`feed-card ${isSaved ? 'feed-card--saved' : ''}`}
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* ── Save checkbox ── */}
      <button
        className={`feed-card__save-btn ${isSaved ? 'feed-card__save-btn--saved' : ''} ${saving ? 'feed-card__save-btn--loading' : ''}`}
        onClick={handleCheckbox}
        title={isSaved ? 'Remove from saved' : 'Save article'}
        aria-label={isSaved ? 'Remove from saved' : 'Save article'}
      >
        {saving
          ? <span className="fa fa-solid fa-spinner fa-spin" />
          : isSaved
            ? <span className="fa fa-solid fa-bookmark" />
            : <span className="fa fa-regular fa-bookmark" />
        }
      </button>

      {article.image && !imgError ? (
        <div className="feed-card__img-wrap">
          <img
            src={article.image}
            alt={article.title}
            className="feed-card__img"
            onError={() => setImgError(true)}
          />
        </div>
      ) : (
        <div className="feed-card__img-placeholder">
          <span className="fa fa-solid fa-newspaper" />
        </div>
      )}

      <div className="feed-card__body">
        <div className="feed-card__meta">
          <span className="feed-card__source">{article.source?.name || 'News'}</span>
          <span className="feed-card__dot" />
          <span className="feed-card__time">{timeAgo(article.publishedAt)}</span>
          {relevant && (
            <span className="feed-card__badge">
              <span className="fa fa-solid fa-star" /> UPSC
            </span>
          )}
        </div>

        <h3 className="feed-card__title">{article.title}</h3>

        {article.description && (
          <p className="feed-card__desc">
            {article.description.length > 140
              ? article.description.slice(0, 140) + '…'
              : article.description}
          </p>
        )}

        <div className="feed-card__footer">
          <span className="feed-card__read">
            Read more <span className="fa fa-solid fa-arrow-right" />
          </span>
          {isSaved && (
            <span className="feed-card__saved-label">
              <span className="fa fa-solid fa-bookmark" /> Saved
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

// ── Skeleton loader ────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="feed-card feed-card--skeleton">
      <div className="feed-card__img-placeholder skeleton-box" />
      <div className="feed-card__body">
        <div className="skeleton-line skeleton-line--short" />
        <div className="skeleton-line" />
        <div className="skeleton-line skeleton-line--medium" />
        <div className="skeleton-line skeleton-line--short" />
      </div>
    </div>
  );
}

// ── Main Feed component ────────────────────────────────────────────────
export default function Feed() {
  const [activeCategory, setActiveCategory] = useState('top');
  const [articlesByCategory, setArticlesByCategory] = useState({});
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [search, setSearch]     = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching]         = useState(false);

  // ── Saved articles state ──
  const [savedArticles, setSavedArticles] = useState({});  // { docId: article }
  const [savingId, setSavingId]           = useState(null); // docId currently being saved
  const [showSaved, setShowSaved]         = useState(false);
  const [savedLoading, setSavedLoading]   = useState(false);
  const [toast, setToast]                 = useState(null); // { msg, type }

  const API_KEY    = import.meta.env.VITE_GNEWS_KEY;
  const userEmail  = auth?.currentUser?.email;

  // ── Load saved articles from Firestore on mount ──
  useEffect(() => {
    if (!userEmail) return;
    setSavedLoading(true);
    const newsCol = collection(db, 'learners', userEmail, 'news');
    getDocs(newsCol)
      .then(snap => {
        const map = {};
        snap.forEach(d => { map[d.id] = d.data(); });
        setSavedArticles(map);
      })
      .catch(err => console.error('Failed to load saved news', err))
      .finally(() => setSavedLoading(false));
  }, [userEmail]);

  // ── Toast helper ──
  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  // ── Toggle save / unsave ──
  async function handleToggleSave(article) {
    if (!userEmail) { showToast('Sign in to save articles.', 'error'); return; }
    const docId   = articleDocId(article.url);
    const newsRef = doc(db, 'learners', userEmail, 'news', docId);

    setSavingId(docId);
    try {
      if (savedArticles[docId]) {
        // unsave
        await deleteDoc(newsRef);
        setSavedArticles(prev => { const n = { ...prev }; delete n[docId]; return n; });
        showToast('Removed from saved.');
      } else {
        // save
        const payload = {
          title:       article.title,
          description: article.description || '',
          url:         article.url,
          image:       article.image || '',
          source:      article.source?.name || '',
          publishedAt: article.publishedAt,
          savedAt:     new Date().toISOString(),
          upscRelevant: isUpscRelevant(article),
        };
        await setDoc(newsRef, payload);
        setSavedArticles(prev => ({ ...prev, [docId]: payload }));
        showToast('Article saved!');
      }
    } catch (err) {
      console.error(err);
      showToast('Something went wrong. Try again.', 'error');
    } finally {
      setSavingId(null);
    }
  }

  // Fetch articles for a category (cached per session)
  const fetchCategory = useCallback(async (categoryId) => {
    if (articlesByCategory[categoryId]) return; // already cached
    if (!API_KEY) {
      setError('GNews API key not found. Add VITE_GNEWS_KEY to your .env file.');
      return;
    }

    setLoading(true);
    setError(null);

    const cat = CATEGORIES.find(c => c.id === categoryId);
    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(cat.query)}&lang=en&country=in&max=10&token=${API_KEY}`;

    try {
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setArticlesByCategory(prev => ({ ...prev, [categoryId]: data.articles || [] }));
    } catch (err) {
      setError('Failed to load news. Please check your API key or try again later.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [API_KEY, articlesByCategory]);

  // Load on mount and category change
  useEffect(() => {
    fetchCategory(activeCategory);
  }, [activeCategory]);

  // Search handler
  async function handleSearch(e) {
    e.preventDefault();
    if (!search.trim()) { setSearchResults(null); return; }
    setSearching(true);
    setError(null);
    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(search)}&lang=en&country=in&max=10&token=${API_KEY}`;
    try {
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setSearchResults(data.articles || []);
    } catch (err) {
      setError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  }

  function clearSearch() {
    setSearch('');
    setSearchResults(null);
  }

  const displayArticles = searchResults ?? (articlesByCategory[activeCategory] || []);
  const isLoading = loading || searching;
  const savedList = Object.values(savedArticles);

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="feed-root">

      {/* ── Toast ── */}
      {toast && (
        <div className={`feed-toast feed-toast--${toast.type}`}>
          <span className={`fa fa-solid ${toast.type === 'error' ? 'fa-circle-xmark' : 'fa-circle-check'}`} />
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div className="feed-header">
        <div className="feed-header__left">
          <div className="feed-header__icon">
            <span className="fa fa-solid fa-bolt" />
          </div>
          <div>
            <h1 className="feed-header__title">Today's Feed</h1>
            <p className="feed-header__date">{today}</p>
          </div>
        </div>

        {/* Search + Saved toggle */}
        <div className="feed-header__right">
          <button
            className={`feed-saved-toggle ${showSaved ? 'feed-saved-toggle--active' : ''}`}
            onClick={() => { setShowSaved(s => !s); setSearchResults(null); }}
            title="View saved articles"
          >
            <span className="fa fa-solid fa-bookmark" />
            <span>Saved</span>
            {savedList.length > 0 && (
              <span className="feed-saved-toggle__count">{savedList.length}</span>
            )}
          </button>

          <form className="feed-search" onSubmit={handleSearch}>
            <span className="fa fa-solid fa-search feed-search__icon" />
            <input
              className="feed-search__input"
              type="text"
              placeholder="Search current affairs…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className="feed-search__clear" onClick={clearSearch}>
                <span className="fa fa-solid fa-xmark" />
              </button>
            )}
            <button type="submit" className="feed-search__btn">Search</button>
          </form>
        </div>
      </div>

      {/* ── UPSC tip banner (hide on saved view) ── */}
      {!showSaved && (
        <div className="feed-tip">
          <span className="fa fa-solid fa-lightbulb feed-tip__icon" />
          <span>Articles marked <strong>★ UPSC</strong> are relevant to competitive exam current affairs.
            <strong> Bookmark</strong> any article to save it for revision.</span>
        </div>
      )}

      {/* ══ SAVED VIEW ══════════════════════════════════════════════ */}
      {showSaved ? (
        <>
          <div className="feed-saved-header">
            <span className="fa fa-solid fa-bookmark" />
            <span>Your Saved Articles</span>
            <span className="feed-saved-header__count">{savedList.length} article{savedList.length !== 1 ? 's' : ''}</span>
          </div>

          {savedLoading ? (
            <div className="feed-grid">
              {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : savedList.length === 0 ? (
            <div className="feed-empty">
              <span className="fa fa-regular fa-bookmark" style={{ fontSize: '3rem' }} />
              <p>No saved articles yet.</p>
              <p style={{ fontSize: '0.8rem', color: '#b0bace' }}>
                Click the bookmark icon on any article to save it here.
              </p>
            </div>
          ) : (
            <div className="feed-grid">
              {savedList.map((article, i) => (
                <ArticleCard
                  key={article.url}
                  article={article}
                  index={i}
                  isSaved={true}
                  saving={savingId === articleDocId(article.url)}
                  onToggleSave={handleToggleSave}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        /* ══ FEED VIEW ══════════════════════════════════════════════ */
        <>
          {/* ── Category tabs ── */}
          {!searchResults && (
            <div className="feed-tabs">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  className={`feed-tab ${activeCategory === cat.id ? 'feed-tab--active' : ''}`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  <span className={`fa fa-solid ${cat.icon}`} />
                  <span className="feed-tab__label">{cat.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Search result header */}
          {searchResults && (
            <div className="feed-search-header">
              <span>{searchResults.length} results for <strong>"{search}"</strong></span>
              <button className="feed-search-header__clear" onClick={clearSearch}>← Back to feed</button>
            </div>
          )}

          {/* ── Error state ── */}
          {error && (
            <div className="feed-error">
              <span className="fa fa-solid fa-triangle-exclamation" /> {error}
            </div>
          )}

          {/* ── Article grid ── */}
          <div className="feed-grid">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
              : displayArticles.length === 0 && !error
                ? (
                  <div className="feed-empty">
                    <span className="fa fa-solid fa-inbox" />
                    <p>No articles found.</p>
                  </div>
                )
                : displayArticles.map((article, i) => (
                  <ArticleCard
                    key={article.url}
                    article={article}
                    index={i}
                    isSaved={!!savedArticles[articleDocId(article.url)]}
                    saving={savingId === articleDocId(article.url)}
                    onToggleSave={handleToggleSave}
                  />
                ))
            }
          </div>
        </>
      )}

    </div>
  );
}