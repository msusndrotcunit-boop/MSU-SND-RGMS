try {
  self["workbox:core:7.3.0"] && _();
} catch {
}
const Z = (s, ...e) => {
  let t = s;
  return e.length > 0 && (t += ` :: ${JSON.stringify(e)}`), t;
}, ee = Z;
class h extends Error {
  /**
   *
   * @param {string} errorCode The error code that
   * identifies this particular error.
   * @param {Object=} details Any relevant arguments
   * that will help developers identify issues should
   * be added as a key on the context object.
   */
  constructor(e, t) {
    const n = ee(e, t);
    super(n), this.name = e, this.details = t;
  }
}
const d = {
  googleAnalytics: "googleAnalytics",
  precache: "precache-v2",
  prefix: "workbox",
  runtime: "runtime",
  suffix: typeof registration < "u" ? registration.scope : ""
}, U = (s) => [d.prefix, s, d.suffix].filter((e) => e && e.length > 0).join("-"), te = (s) => {
  for (const e of Object.keys(d))
    s(e);
}, C = {
  updateDetails: (s) => {
    te((e) => {
      typeof s[e] == "string" && (d[e] = s[e]);
    });
  },
  getGoogleAnalyticsName: (s) => s || U(d.googleAnalytics),
  getPrecacheName: (s) => s || U(d.precache),
  getPrefix: () => d.prefix,
  getRuntimeName: (s) => s || U(d.runtime),
  getSuffix: () => d.suffix
};
function v(s, e) {
  const t = e();
  return s.waitUntil(t), t;
}
try {
  self["workbox:precaching:7.3.0"] && _();
} catch {
}
const se = "__WB_REVISION__";
function ne(s) {
  if (!s)
    throw new h("add-to-cache-list-unexpected-type", { entry: s });
  if (typeof s == "string") {
    const i = new URL(s, location.href);
    return {
      cacheKey: i.href,
      url: i.href
    };
  }
  const { revision: e, url: t } = s;
  if (!t)
    throw new h("add-to-cache-list-unexpected-type", { entry: s });
  if (!e) {
    const i = new URL(t, location.href);
    return {
      cacheKey: i.href,
      url: i.href
    };
  }
  const n = new URL(t, location.href), a = new URL(t, location.href);
  return n.searchParams.set(se, e), {
    cacheKey: n.href,
    url: a.href
  };
}
class ae {
  constructor() {
    this.updatedURLs = [], this.notUpdatedURLs = [], this.handlerWillStart = async ({ request: e, state: t }) => {
      t && (t.originalRequest = e);
    }, this.cachedResponseWillBeUsed = async ({ event: e, state: t, cachedResponse: n }) => {
      if (e.type === "install" && t && t.originalRequest && t.originalRequest instanceof Request) {
        const a = t.originalRequest.url;
        n ? this.notUpdatedURLs.push(a) : this.updatedURLs.push(a);
      }
      return n;
    };
  }
}
class ie {
  constructor({ precacheController: e }) {
    this.cacheKeyWillBeUsed = async ({ request: t, params: n }) => {
      const a = (n == null ? void 0 : n.cacheKey) || this._precacheController.getCacheKeyForURL(t.url);
      return a ? new Request(a, { headers: t.headers }) : t;
    }, this._precacheController = e;
  }
}
let w;
function re() {
  if (w === void 0) {
    const s = new Response("");
    if ("body" in s)
      try {
        new Response(s.body), w = !0;
      } catch {
        w = !1;
      }
    w = !1;
  }
  return w;
}
async function oe(s, e) {
  let t = null;
  if (s.url && (t = new URL(s.url).origin), t !== self.location.origin)
    throw new h("cross-origin-copy-response", { origin: t });
  const n = s.clone(), i = {
    headers: new Headers(n.headers),
    status: n.status,
    statusText: n.statusText
  }, r = re() ? n.body : await n.blob();
  return new Response(r, i);
}
const ce = (s) => new URL(String(s), location.href).href.replace(new RegExp(`^${location.origin}`), "");
function O(s, e) {
  const t = new URL(s);
  for (const n of e)
    t.searchParams.delete(n);
  return t.href;
}
async function le(s, e, t, n) {
  const a = O(e.url, t);
  if (e.url === a)
    return s.match(e, n);
  const i = Object.assign(Object.assign({}, n), { ignoreSearch: !0 }), r = await s.keys(e, i);
  for (const o of r) {
    const c = O(o.url, t);
    if (a === c)
      return s.match(o, n);
  }
}
class he {
  /**
   * Creates a promise and exposes its resolve and reject functions as methods.
   */
  constructor() {
    this.promise = new Promise((e, t) => {
      this.resolve = e, this.reject = t;
    });
  }
}
const q = /* @__PURE__ */ new Set();
async function ue() {
  for (const s of q)
    await s();
}
function F(s) {
  return new Promise((e) => setTimeout(e, s));
}
try {
  self["workbox:strategies:7.3.0"] && _();
} catch {
}
function T(s) {
  return typeof s == "string" ? new Request(s) : s;
}
class de {
  /**
   * Creates a new instance associated with the passed strategy and event
   * that's handling the request.
   *
   * The constructor also initializes the state that will be passed to each of
   * the plugins handling this request.
   *
   * @param {workbox-strategies.Strategy} strategy
   * @param {Object} options
   * @param {Request|string} options.request A request to run this strategy for.
   * @param {ExtendableEvent} options.event The event associated with the
   *     request.
   * @param {URL} [options.url]
   * @param {*} [options.params] The return value from the
   *     {@link workbox-routing~matchCallback} (if applicable).
   */
  constructor(e, t) {
    this._cacheKeys = {}, Object.assign(this, t), this.event = t.event, this._strategy = e, this._handlerDeferred = new he(), this._extendLifetimePromises = [], this._plugins = [...e.plugins], this._pluginStateMap = /* @__PURE__ */ new Map();
    for (const n of this._plugins)
      this._pluginStateMap.set(n, {});
    this.event.waitUntil(this._handlerDeferred.promise);
  }
  /**
   * Fetches a given request (and invokes any applicable plugin callback
   * methods) using the `fetchOptions` (for non-navigation requests) and
   * `plugins` defined on the `Strategy` object.
   *
   * The following plugin lifecycle methods are invoked when using this method:
   * - `requestWillFetch()`
   * - `fetchDidSucceed()`
   * - `fetchDidFail()`
   *
   * @param {Request|string} input The URL or request to fetch.
   * @return {Promise<Response>}
   */
  async fetch(e) {
    const { event: t } = this;
    let n = T(e);
    if (n.mode === "navigate" && t instanceof FetchEvent && t.preloadResponse) {
      const r = await t.preloadResponse;
      if (r)
        return r;
    }
    const a = this.hasCallback("fetchDidFail") ? n.clone() : null;
    try {
      for (const r of this.iterateCallbacks("requestWillFetch"))
        n = await r({ request: n.clone(), event: t });
    } catch (r) {
      if (r instanceof Error)
        throw new h("plugin-error-request-will-fetch", {
          thrownErrorMessage: r.message
        });
    }
    const i = n.clone();
    try {
      let r;
      r = await fetch(n, n.mode === "navigate" ? void 0 : this._strategy.fetchOptions);
      for (const o of this.iterateCallbacks("fetchDidSucceed"))
        r = await o({
          event: t,
          request: i,
          response: r
        });
      return r;
    } catch (r) {
      throw a && await this.runCallbacks("fetchDidFail", {
        error: r,
        event: t,
        originalRequest: a.clone(),
        request: i.clone()
      }), r;
    }
  }
  /**
   * Calls `this.fetch()` and (in the background) runs `this.cachePut()` on
   * the response generated by `this.fetch()`.
   *
   * The call to `this.cachePut()` automatically invokes `this.waitUntil()`,
   * so you do not have to manually call `waitUntil()` on the event.
   *
   * @param {Request|string} input The request or URL to fetch and cache.
   * @return {Promise<Response>}
   */
  async fetchAndCachePut(e) {
    const t = await this.fetch(e), n = t.clone();
    return this.waitUntil(this.cachePut(e, n)), t;
  }
  /**
   * Matches a request from the cache (and invokes any applicable plugin
   * callback methods) using the `cacheName`, `matchOptions`, and `plugins`
   * defined on the strategy object.
   *
   * The following plugin lifecycle methods are invoked when using this method:
   * - cacheKeyWillBeUsed()
   * - cachedResponseWillBeUsed()
   *
   * @param {Request|string} key The Request or URL to use as the cache key.
   * @return {Promise<Response|undefined>} A matching response, if found.
   */
  async cacheMatch(e) {
    const t = T(e);
    let n;
    const { cacheName: a, matchOptions: i } = this._strategy, r = await this.getCacheKey(t, "read"), o = Object.assign(Object.assign({}, i), { cacheName: a });
    n = await caches.match(r, o);
    for (const c of this.iterateCallbacks("cachedResponseWillBeUsed"))
      n = await c({
        cacheName: a,
        matchOptions: i,
        cachedResponse: n,
        request: r,
        event: this.event
      }) || void 0;
    return n;
  }
  /**
   * Puts a request/response pair in the cache (and invokes any applicable
   * plugin callback methods) using the `cacheName` and `plugins` defined on
   * the strategy object.
   *
   * The following plugin lifecycle methods are invoked when using this method:
   * - cacheKeyWillBeUsed()
   * - cacheWillUpdate()
   * - cacheDidUpdate()
   *
   * @param {Request|string} key The request or URL to use as the cache key.
   * @param {Response} response The response to cache.
   * @return {Promise<boolean>} `false` if a cacheWillUpdate caused the response
   * not be cached, and `true` otherwise.
   */
  async cachePut(e, t) {
    const n = T(e);
    await F(0);
    const a = await this.getCacheKey(n, "write");
    if (!t)
      throw new h("cache-put-with-no-response", {
        url: ce(a.url)
      });
    const i = await this._ensureResponseSafeToCache(t);
    if (!i)
      return !1;
    const { cacheName: r, matchOptions: o } = this._strategy, c = await self.caches.open(r), l = this.hasCallback("cacheDidUpdate"), g = l ? await le(
      // TODO(philipwalton): the `__WB_REVISION__` param is a precaching
      // feature. Consider into ways to only add this behavior if using
      // precaching.
      c,
      a.clone(),
      ["__WB_REVISION__"],
      o
    ) : null;
    try {
      await c.put(a, l ? i.clone() : i);
    } catch (u) {
      if (u instanceof Error)
        throw u.name === "QuotaExceededError" && await ue(), u;
    }
    for (const u of this.iterateCallbacks("cacheDidUpdate"))
      await u({
        cacheName: r,
        oldResponse: g,
        newResponse: i.clone(),
        request: a,
        event: this.event
      });
    return !0;
  }
  /**
   * Checks the list of plugins for the `cacheKeyWillBeUsed` callback, and
   * executes any of those callbacks found in sequence. The final `Request`
   * object returned by the last plugin is treated as the cache key for cache
   * reads and/or writes. If no `cacheKeyWillBeUsed` plugin callbacks have
   * been registered, the passed request is returned unmodified
   *
   * @param {Request} request
   * @param {string} mode
   * @return {Promise<Request>}
   */
  async getCacheKey(e, t) {
    const n = `${e.url} | ${t}`;
    if (!this._cacheKeys[n]) {
      let a = e;
      for (const i of this.iterateCallbacks("cacheKeyWillBeUsed"))
        a = T(await i({
          mode: t,
          request: a,
          event: this.event,
          // params has a type any can't change right now.
          params: this.params
          // eslint-disable-line
        }));
      this._cacheKeys[n] = a;
    }
    return this._cacheKeys[n];
  }
  /**
   * Returns true if the strategy has at least one plugin with the given
   * callback.
   *
   * @param {string} name The name of the callback to check for.
   * @return {boolean}
   */
  hasCallback(e) {
    for (const t of this._strategy.plugins)
      if (e in t)
        return !0;
    return !1;
  }
  /**
   * Runs all plugin callbacks matching the given name, in order, passing the
   * given param object (merged ith the current plugin state) as the only
   * argument.
   *
   * Note: since this method runs all plugins, it's not suitable for cases
   * where the return value of a callback needs to be applied prior to calling
   * the next callback. See
   * {@link workbox-strategies.StrategyHandler#iterateCallbacks}
   * below for how to handle that case.
   *
   * @param {string} name The name of the callback to run within each plugin.
   * @param {Object} param The object to pass as the first (and only) param
   *     when executing each callback. This object will be merged with the
   *     current plugin state prior to callback execution.
   */
  async runCallbacks(e, t) {
    for (const n of this.iterateCallbacks(e))
      await n(t);
  }
  /**
   * Accepts a callback and returns an iterable of matching plugin callbacks,
   * where each callback is wrapped with the current handler state (i.e. when
   * you call each callback, whatever object parameter you pass it will
   * be merged with the plugin's current state).
   *
   * @param {string} name The name fo the callback to run
   * @return {Array<Function>}
   */
  *iterateCallbacks(e) {
    for (const t of this._strategy.plugins)
      if (typeof t[e] == "function") {
        const n = this._pluginStateMap.get(t);
        yield (i) => {
          const r = Object.assign(Object.assign({}, i), { state: n });
          return t[e](r);
        };
      }
  }
  /**
   * Adds a promise to the
   * [extend lifetime promises]{@link https://w3c.github.io/ServiceWorker/#extendableevent-extend-lifetime-promises}
   * of the event associated with the request being handled (usually a
   * `FetchEvent`).
   *
   * Note: you can await
   * {@link workbox-strategies.StrategyHandler~doneWaiting}
   * to know when all added promises have settled.
   *
   * @param {Promise} promise A promise to add to the extend lifetime promises
   *     of the event that triggered the request.
   */
  waitUntil(e) {
    return this._extendLifetimePromises.push(e), e;
  }
  /**
   * Returns a promise that resolves once all promises passed to
   * {@link workbox-strategies.StrategyHandler~waitUntil}
   * have settled.
   *
   * Note: any work done after `doneWaiting()` settles should be manually
   * passed to an event's `waitUntil()` method (not this handler's
   * `waitUntil()` method), otherwise the service worker thread may be killed
   * prior to your work completing.
   */
  async doneWaiting() {
    for (; this._extendLifetimePromises.length; ) {
      const e = this._extendLifetimePromises.splice(0), n = (await Promise.allSettled(e)).find((a) => a.status === "rejected");
      if (n)
        throw n.reason;
    }
  }
  /**
   * Stops running the strategy and immediately resolves any pending
   * `waitUntil()` promises.
   */
  destroy() {
    this._handlerDeferred.resolve(null);
  }
  /**
   * This method will call cacheWillUpdate on the available plugins (or use
   * status === 200) to determine if the Response is safe and valid to cache.
   *
   * @param {Request} options.request
   * @param {Response} options.response
   * @return {Promise<Response|undefined>}
   *
   * @private
   */
  async _ensureResponseSafeToCache(e) {
    let t = e, n = !1;
    for (const a of this.iterateCallbacks("cacheWillUpdate"))
      if (t = await a({
        request: this.request,
        response: t,
        event: this.event
      }) || void 0, n = !0, !t)
        break;
    return n || t && t.status !== 200 && (t = void 0), t;
  }
}
class x {
  /**
   * Creates a new instance of the strategy and sets all documented option
   * properties as public instance properties.
   *
   * Note: if a custom strategy class extends the base Strategy class and does
   * not need more than these properties, it does not need to define its own
   * constructor.
   *
   * @param {Object} [options]
   * @param {string} [options.cacheName] Cache name to store and retrieve
   * requests. Defaults to the cache names provided by
   * {@link workbox-core.cacheNames}.
   * @param {Array<Object>} [options.plugins] [Plugins]{@link https://developers.google.com/web/tools/workbox/guides/using-plugins}
   * to use in conjunction with this caching strategy.
   * @param {Object} [options.fetchOptions] Values passed along to the
   * [`init`](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters)
   * of [non-navigation](https://github.com/GoogleChrome/workbox/issues/1796)
   * `fetch()` requests made by this strategy.
   * @param {Object} [options.matchOptions] The
   * [`CacheQueryOptions`]{@link https://w3c.github.io/ServiceWorker/#dictdef-cachequeryoptions}
   * for any `cache.match()` or `cache.put()` calls made by this strategy.
   */
  constructor(e = {}) {
    this.cacheName = C.getRuntimeName(e.cacheName), this.plugins = e.plugins || [], this.fetchOptions = e.fetchOptions, this.matchOptions = e.matchOptions;
  }
  /**
   * Perform a request strategy and returns a `Promise` that will resolve with
   * a `Response`, invoking all relevant plugin callbacks.
   *
   * When a strategy instance is registered with a Workbox
   * {@link workbox-routing.Route}, this method is automatically
   * called when the route matches.
   *
   * Alternatively, this method can be used in a standalone `FetchEvent`
   * listener by passing it to `event.respondWith()`.
   *
   * @param {FetchEvent|Object} options A `FetchEvent` or an object with the
   *     properties listed below.
   * @param {Request|string} options.request A request to run this strategy for.
   * @param {ExtendableEvent} options.event The event associated with the
   *     request.
   * @param {URL} [options.url]
   * @param {*} [options.params]
   */
  handle(e) {
    const [t] = this.handleAll(e);
    return t;
  }
  /**
   * Similar to {@link workbox-strategies.Strategy~handle}, but
   * instead of just returning a `Promise` that resolves to a `Response` it
   * it will return an tuple of `[response, done]` promises, where the former
   * (`response`) is equivalent to what `handle()` returns, and the latter is a
   * Promise that will resolve once any promises that were added to
   * `event.waitUntil()` as part of performing the strategy have completed.
   *
   * You can await the `done` promise to ensure any extra work performed by
   * the strategy (usually caching responses) completes successfully.
   *
   * @param {FetchEvent|Object} options A `FetchEvent` or an object with the
   *     properties listed below.
   * @param {Request|string} options.request A request to run this strategy for.
   * @param {ExtendableEvent} options.event The event associated with the
   *     request.
   * @param {URL} [options.url]
   * @param {*} [options.params]
   * @return {Array<Promise>} A tuple of [response, done]
   *     promises that can be used to determine when the response resolves as
   *     well as when the handler has completed all its work.
   */
  handleAll(e) {
    e instanceof FetchEvent && (e = {
      event: e,
      request: e.request
    });
    const t = e.event, n = typeof e.request == "string" ? new Request(e.request) : e.request, a = "params" in e ? e.params : void 0, i = new de(this, { event: t, request: n, params: a }), r = this._getResponse(i, n, t), o = this._awaitComplete(r, i, n, t);
    return [r, o];
  }
  async _getResponse(e, t, n) {
    await e.runCallbacks("handlerWillStart", { event: n, request: t });
    let a;
    try {
      if (a = await this._handle(t, e), !a || a.type === "error")
        throw new h("no-response", { url: t.url });
    } catch (i) {
      if (i instanceof Error) {
        for (const r of e.iterateCallbacks("handlerDidError"))
          if (a = await r({ error: i, event: n, request: t }), a)
            break;
      }
      if (!a)
        throw i;
    }
    for (const i of e.iterateCallbacks("handlerWillRespond"))
      a = await i({ event: n, request: t, response: a });
    return a;
  }
  async _awaitComplete(e, t, n, a) {
    let i, r;
    try {
      i = await e;
    } catch {
    }
    try {
      await t.runCallbacks("handlerDidRespond", {
        event: a,
        request: n,
        response: i
      }), await t.doneWaiting();
    } catch (o) {
      o instanceof Error && (r = o);
    }
    if (await t.runCallbacks("handlerDidComplete", {
      event: a,
      request: n,
      response: i,
      error: r
    }), t.destroy(), r)
      throw r;
  }
}
class p extends x {
  /**
   *
   * @param {Object} [options]
   * @param {string} [options.cacheName] Cache name to store and retrieve
   * requests. Defaults to the cache names provided by
   * {@link workbox-core.cacheNames}.
   * @param {Array<Object>} [options.plugins] {@link https://developers.google.com/web/tools/workbox/guides/using-plugins|Plugins}
   * to use in conjunction with this caching strategy.
   * @param {Object} [options.fetchOptions] Values passed along to the
   * {@link https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters|init}
   * of all fetch() requests made by this strategy.
   * @param {Object} [options.matchOptions] The
   * {@link https://w3c.github.io/ServiceWorker/#dictdef-cachequeryoptions|CacheQueryOptions}
   * for any `cache.match()` or `cache.put()` calls made by this strategy.
   * @param {boolean} [options.fallbackToNetwork=true] Whether to attempt to
   * get the response from the network if there's a precache miss.
   */
  constructor(e = {}) {
    e.cacheName = C.getPrecacheName(e.cacheName), super(e), this._fallbackToNetwork = e.fallbackToNetwork !== !1, this.plugins.push(p.copyRedirectedCacheableResponsesPlugin);
  }
  /**
   * @private
   * @param {Request|string} request A request to run this strategy for.
   * @param {workbox-strategies.StrategyHandler} handler The event that
   *     triggered the request.
   * @return {Promise<Response>}
   */
  async _handle(e, t) {
    const n = await t.cacheMatch(e);
    return n || (t.event && t.event.type === "install" ? await this._handleInstall(e, t) : await this._handleFetch(e, t));
  }
  async _handleFetch(e, t) {
    let n;
    const a = t.params || {};
    if (this._fallbackToNetwork) {
      const i = a.integrity, r = e.integrity, o = !r || r === i;
      n = await t.fetch(new Request(e, {
        integrity: e.mode !== "no-cors" ? r || i : void 0
      })), i && o && e.mode !== "no-cors" && (this._useDefaultCacheabilityPluginIfNeeded(), await t.cachePut(e, n.clone()));
    } else
      throw new h("missing-precache-entry", {
        cacheName: this.cacheName,
        url: e.url
      });
    return n;
  }
  async _handleInstall(e, t) {
    this._useDefaultCacheabilityPluginIfNeeded();
    const n = await t.fetch(e);
    if (!await t.cachePut(e, n.clone()))
      throw new h("bad-precaching-response", {
        url: e.url,
        status: n.status
      });
    return n;
  }
  /**
   * This method is complex, as there a number of things to account for:
   *
   * The `plugins` array can be set at construction, and/or it might be added to
   * to at any time before the strategy is used.
   *
   * At the time the strategy is used (i.e. during an `install` event), there
   * needs to be at least one plugin that implements `cacheWillUpdate` in the
   * array, other than `copyRedirectedCacheableResponsesPlugin`.
   *
   * - If this method is called and there are no suitable `cacheWillUpdate`
   * plugins, we need to add `defaultPrecacheCacheabilityPlugin`.
   *
   * - If this method is called and there is exactly one `cacheWillUpdate`, then
   * we don't have to do anything (this might be a previously added
   * `defaultPrecacheCacheabilityPlugin`, or it might be a custom plugin).
   *
   * - If this method is called and there is more than one `cacheWillUpdate`,
   * then we need to check if one is `defaultPrecacheCacheabilityPlugin`. If so,
   * we need to remove it. (This situation is unlikely, but it could happen if
   * the strategy is used multiple times, the first without a `cacheWillUpdate`,
   * and then later on after manually adding a custom `cacheWillUpdate`.)
   *
   * See https://github.com/GoogleChrome/workbox/issues/2737 for more context.
   *
   * @private
   */
  _useDefaultCacheabilityPluginIfNeeded() {
    let e = null, t = 0;
    for (const [n, a] of this.plugins.entries())
      a !== p.copyRedirectedCacheableResponsesPlugin && (a === p.defaultPrecacheCacheabilityPlugin && (e = n), a.cacheWillUpdate && t++);
    t === 0 ? this.plugins.push(p.defaultPrecacheCacheabilityPlugin) : t > 1 && e !== null && this.plugins.splice(e, 1);
  }
}
p.defaultPrecacheCacheabilityPlugin = {
  async cacheWillUpdate({ response: s }) {
    return !s || s.status >= 400 ? null : s;
  }
};
p.copyRedirectedCacheableResponsesPlugin = {
  async cacheWillUpdate({ response: s }) {
    return s.redirected ? await oe(s) : s;
  }
};
class fe {
  /**
   * Create a new PrecacheController.
   *
   * @param {Object} [options]
   * @param {string} [options.cacheName] The cache to use for precaching.
   * @param {string} [options.plugins] Plugins to use when precaching as well
   * as responding to fetch events for precached assets.
   * @param {boolean} [options.fallbackToNetwork=true] Whether to attempt to
   * get the response from the network if there's a precache miss.
   */
  constructor({ cacheName: e, plugins: t = [], fallbackToNetwork: n = !0 } = {}) {
    this._urlsToCacheKeys = /* @__PURE__ */ new Map(), this._urlsToCacheModes = /* @__PURE__ */ new Map(), this._cacheKeysToIntegrities = /* @__PURE__ */ new Map(), this._strategy = new p({
      cacheName: C.getPrecacheName(e),
      plugins: [
        ...t,
        new ie({ precacheController: this })
      ],
      fallbackToNetwork: n
    }), this.install = this.install.bind(this), this.activate = this.activate.bind(this);
  }
  /**
   * @type {workbox-precaching.PrecacheStrategy} The strategy created by this controller and
   * used to cache assets and respond to fetch events.
   */
  get strategy() {
    return this._strategy;
  }
  /**
   * Adds items to the precache list, removing any duplicates and
   * stores the files in the
   * {@link workbox-core.cacheNames|"precache cache"} when the service
   * worker installs.
   *
   * This method can be called multiple times.
   *
   * @param {Array<Object|string>} [entries=[]] Array of entries to precache.
   */
  precache(e) {
    this.addToCacheList(e), this._installAndActiveListenersAdded || (self.addEventListener("install", this.install), self.addEventListener("activate", this.activate), this._installAndActiveListenersAdded = !0);
  }
  /**
   * This method will add items to the precache list, removing duplicates
   * and ensuring the information is valid.
   *
   * @param {Array<workbox-precaching.PrecacheController.PrecacheEntry|string>} entries
   *     Array of entries to precache.
   */
  addToCacheList(e) {
    const t = [];
    for (const n of e) {
      typeof n == "string" ? t.push(n) : n && n.revision === void 0 && t.push(n.url);
      const { cacheKey: a, url: i } = ne(n), r = typeof n != "string" && n.revision ? "reload" : "default";
      if (this._urlsToCacheKeys.has(i) && this._urlsToCacheKeys.get(i) !== a)
        throw new h("add-to-cache-list-conflicting-entries", {
          firstEntry: this._urlsToCacheKeys.get(i),
          secondEntry: a
        });
      if (typeof n != "string" && n.integrity) {
        if (this._cacheKeysToIntegrities.has(a) && this._cacheKeysToIntegrities.get(a) !== n.integrity)
          throw new h("add-to-cache-list-conflicting-integrities", {
            url: i
          });
        this._cacheKeysToIntegrities.set(a, n.integrity);
      }
      if (this._urlsToCacheKeys.set(i, a), this._urlsToCacheModes.set(i, r), t.length > 0) {
        const o = `Workbox is precaching URLs without revision info: ${t.join(", ")}
This is generally NOT safe. Learn more at https://bit.ly/wb-precache`;
        console.warn(o);
      }
    }
  }
  /**
   * Precaches new and updated assets. Call this method from the service worker
   * install event.
   *
   * Note: this method calls `event.waitUntil()` for you, so you do not need
   * to call it yourself in your event handlers.
   *
   * @param {ExtendableEvent} event
   * @return {Promise<workbox-precaching.InstallResult>}
   */
  install(e) {
    return v(e, async () => {
      const t = new ae();
      this.strategy.plugins.push(t);
      for (const [i, r] of this._urlsToCacheKeys) {
        const o = this._cacheKeysToIntegrities.get(r), c = this._urlsToCacheModes.get(i), l = new Request(i, {
          integrity: o,
          cache: c,
          credentials: "same-origin"
        });
        await Promise.all(this.strategy.handleAll({
          params: { cacheKey: r },
          request: l,
          event: e
        }));
      }
      const { updatedURLs: n, notUpdatedURLs: a } = t;
      return { updatedURLs: n, notUpdatedURLs: a };
    });
  }
  /**
   * Deletes assets that are no longer present in the current precache manifest.
   * Call this method from the service worker activate event.
   *
   * Note: this method calls `event.waitUntil()` for you, so you do not need
   * to call it yourself in your event handlers.
   *
   * @param {ExtendableEvent} event
   * @return {Promise<workbox-precaching.CleanupResult>}
   */
  activate(e) {
    return v(e, async () => {
      const t = await self.caches.open(this.strategy.cacheName), n = await t.keys(), a = new Set(this._urlsToCacheKeys.values()), i = [];
      for (const r of n)
        a.has(r.url) || (await t.delete(r), i.push(r.url));
      return { deletedURLs: i };
    });
  }
  /**
   * Returns a mapping of a precached URL to the corresponding cache key, taking
   * into account the revision information for the URL.
   *
   * @return {Map<string, string>} A URL to cache key mapping.
   */
  getURLsToCacheKeys() {
    return this._urlsToCacheKeys;
  }
  /**
   * Returns a list of all the URLs that have been precached by the current
   * service worker.
   *
   * @return {Array<string>} The precached URLs.
   */
  getCachedURLs() {
    return [...this._urlsToCacheKeys.keys()];
  }
  /**
   * Returns the cache key used for storing a given URL. If that URL is
   * unversioned, like `/index.html', then the cache key will be the original
   * URL with a search parameter appended to it.
   *
   * @param {string} url A URL whose cache key you want to look up.
   * @return {string} The versioned URL that corresponds to a cache key
   * for the original URL, or undefined if that URL isn't precached.
   */
  getCacheKeyForURL(e) {
    const t = new URL(e, location.href);
    return this._urlsToCacheKeys.get(t.href);
  }
  /**
   * @param {string} url A cache key whose SRI you want to look up.
   * @return {string} The subresource integrity associated with the cache key,
   * or undefined if it's not set.
   */
  getIntegrityForCacheKey(e) {
    return this._cacheKeysToIntegrities.get(e);
  }
  /**
   * This acts as a drop-in replacement for
   * [`cache.match()`](https://developer.mozilla.org/en-US/docs/Web/API/Cache/match)
   * with the following differences:
   *
   * - It knows what the name of the precache is, and only checks in that cache.
   * - It allows you to pass in an "original" URL without versioning parameters,
   * and it will automatically look up the correct cache key for the currently
   * active revision of that URL.
   *
   * E.g., `matchPrecache('index.html')` will find the correct precached
   * response for the currently active service worker, even if the actual cache
   * key is `'/index.html?__WB_REVISION__=1234abcd'`.
   *
   * @param {string|Request} request The key (without revisioning parameters)
   * to look up in the precache.
   * @return {Promise<Response|undefined>}
   */
  async matchPrecache(e) {
    const t = e instanceof Request ? e.url : e, n = this.getCacheKeyForURL(t);
    if (n)
      return (await self.caches.open(this.strategy.cacheName)).match(n);
  }
  /**
   * Returns a function that looks up `url` in the precache (taking into
   * account revision information), and returns the corresponding `Response`.
   *
   * @param {string} url The precached URL which will be used to lookup the
   * `Response`.
   * @return {workbox-routing~handlerCallback}
   */
  createHandlerBoundToURL(e) {
    const t = this.getCacheKeyForURL(e);
    if (!t)
      throw new h("non-precached-url", { url: e });
    return (n) => (n.request = new Request(e), n.params = Object.assign({ cacheKey: t }, n.params), this.strategy.handle(n));
  }
}
let P;
const H = () => (P || (P = new fe()), P);
try {
  self["workbox:routing:7.3.0"] && _();
} catch {
}
const V = "GET", k = (s) => s && typeof s == "object" ? s : { handle: s };
class R {
  /**
   * Constructor for Route class.
   *
   * @param {workbox-routing~matchCallback} match
   * A callback function that determines whether the route matches a given
   * `fetch` event by returning a non-falsy value.
   * @param {workbox-routing~handlerCallback} handler A callback
   * function that returns a Promise resolving to a Response.
   * @param {string} [method='GET'] The HTTP method to match the Route
   * against.
   */
  constructor(e, t, n = V) {
    this.handler = k(t), this.match = e, this.method = n;
  }
  /**
   *
   * @param {workbox-routing-handlerCallback} handler A callback
   * function that returns a Promise resolving to a Response
   */
  setCatchHandler(e) {
    this.catchHandler = k(e);
  }
}
class pe extends R {
  /**
   * If the regular expression contains
   * [capture groups]{@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp#grouping-back-references},
   * the captured values will be passed to the
   * {@link workbox-routing~handlerCallback} `params`
   * argument.
   *
   * @param {RegExp} regExp The regular expression to match against URLs.
   * @param {workbox-routing~handlerCallback} handler A callback
   * function that returns a Promise resulting in a Response.
   * @param {string} [method='GET'] The HTTP method to match the Route
   * against.
   */
  constructor(e, t, n) {
    const a = ({ url: i }) => {
      const r = e.exec(i.href);
      if (r && !(i.origin !== location.origin && r.index !== 0))
        return r.slice(1);
    };
    super(a, t, n);
  }
}
class me {
  /**
   * Initializes a new Router.
   */
  constructor() {
    this._routes = /* @__PURE__ */ new Map(), this._defaultHandlerMap = /* @__PURE__ */ new Map();
  }
  /**
   * @return {Map<string, Array<workbox-routing.Route>>} routes A `Map` of HTTP
   * method name ('GET', etc.) to an array of all the corresponding `Route`
   * instances that are registered.
   */
  get routes() {
    return this._routes;
  }
  /**
   * Adds a fetch event listener to respond to events when a route matches
   * the event's request.
   */
  addFetchListener() {
    self.addEventListener("fetch", ((e) => {
      const { request: t } = e, n = this.handleRequest({ request: t, event: e });
      n && e.respondWith(n);
    }));
  }
  /**
   * Adds a message event listener for URLs to cache from the window.
   * This is useful to cache resources loaded on the page prior to when the
   * service worker started controlling it.
   *
   * The format of the message data sent from the window should be as follows.
   * Where the `urlsToCache` array may consist of URL strings or an array of
   * URL string + `requestInit` object (the same as you'd pass to `fetch()`).
   *
   * ```
   * {
   *   type: 'CACHE_URLS',
   *   payload: {
   *     urlsToCache: [
   *       './script1.js',
   *       './script2.js',
   *       ['./script3.js', {mode: 'no-cors'}],
   *     ],
   *   },
   * }
   * ```
   */
  addCacheListener() {
    self.addEventListener("message", ((e) => {
      if (e.data && e.data.type === "CACHE_URLS") {
        const { payload: t } = e.data, n = Promise.all(t.urlsToCache.map((a) => {
          typeof a == "string" && (a = [a]);
          const i = new Request(...a);
          return this.handleRequest({ request: i, event: e });
        }));
        e.waitUntil(n), e.ports && e.ports[0] && n.then(() => e.ports[0].postMessage(!0));
      }
    }));
  }
  /**
   * Apply the routing rules to a FetchEvent object to get a Response from an
   * appropriate Route's handler.
   *
   * @param {Object} options
   * @param {Request} options.request The request to handle.
   * @param {ExtendableEvent} options.event The event that triggered the
   *     request.
   * @return {Promise<Response>|undefined} A promise is returned if a
   *     registered route can handle the request. If there is no matching
   *     route and there's no `defaultHandler`, `undefined` is returned.
   */
  handleRequest({ request: e, event: t }) {
    const n = new URL(e.url, location.href);
    if (!n.protocol.startsWith("http"))
      return;
    const a = n.origin === location.origin, { params: i, route: r } = this.findMatchingRoute({
      event: t,
      request: e,
      sameOrigin: a,
      url: n
    });
    let o = r && r.handler;
    const c = e.method;
    if (!o && this._defaultHandlerMap.has(c) && (o = this._defaultHandlerMap.get(c)), !o)
      return;
    let l;
    try {
      l = o.handle({ url: n, request: e, event: t, params: i });
    } catch (u) {
      l = Promise.reject(u);
    }
    const g = r && r.catchHandler;
    return l instanceof Promise && (this._catchHandler || g) && (l = l.catch(async (u) => {
      if (g)
        try {
          return await g.handle({ url: n, request: e, event: t, params: i });
        } catch (A) {
          A instanceof Error && (u = A);
        }
      if (this._catchHandler)
        return this._catchHandler.handle({ url: n, request: e, event: t });
      throw u;
    })), l;
  }
  /**
   * Checks a request and URL (and optionally an event) against the list of
   * registered routes, and if there's a match, returns the corresponding
   * route along with any params generated by the match.
   *
   * @param {Object} options
   * @param {URL} options.url
   * @param {boolean} options.sameOrigin The result of comparing `url.origin`
   *     against the current origin.
   * @param {Request} options.request The request to match.
   * @param {Event} options.event The corresponding event.
   * @return {Object} An object with `route` and `params` properties.
   *     They are populated if a matching route was found or `undefined`
   *     otherwise.
   */
  findMatchingRoute({ url: e, sameOrigin: t, request: n, event: a }) {
    const i = this._routes.get(n.method) || [];
    for (const r of i) {
      let o;
      const c = r.match({ url: e, sameOrigin: t, request: n, event: a });
      if (c)
        return o = c, (Array.isArray(o) && o.length === 0 || c.constructor === Object && // eslint-disable-line
        Object.keys(c).length === 0 || typeof c == "boolean") && (o = void 0), { route: r, params: o };
    }
    return {};
  }
  /**
   * Define a default `handler` that's called when no routes explicitly
   * match the incoming request.
   *
   * Each HTTP method ('GET', 'POST', etc.) gets its own default handler.
   *
   * Without a default handler, unmatched requests will go against the
   * network as if there were no service worker present.
   *
   * @param {workbox-routing~handlerCallback} handler A callback
   * function that returns a Promise resulting in a Response.
   * @param {string} [method='GET'] The HTTP method to associate with this
   * default handler. Each method has its own default.
   */
  setDefaultHandler(e, t = V) {
    this._defaultHandlerMap.set(t, k(e));
  }
  /**
   * If a Route throws an error while handling a request, this `handler`
   * will be called and given a chance to provide a response.
   *
   * @param {workbox-routing~handlerCallback} handler A callback
   * function that returns a Promise resulting in a Response.
   */
  setCatchHandler(e) {
    this._catchHandler = k(e);
  }
  /**
   * Registers a route with the router.
   *
   * @param {workbox-routing.Route} route The route to register.
   */
  registerRoute(e) {
    this._routes.has(e.method) || this._routes.set(e.method, []), this._routes.get(e.method).push(e);
  }
  /**
   * Unregisters a route with the router.
   *
   * @param {workbox-routing.Route} route The route to unregister.
   */
  unregisterRoute(e) {
    if (!this._routes.has(e.method))
      throw new h("unregister-route-but-not-found-with-method", {
        method: e.method
      });
    const t = this._routes.get(e.method).indexOf(e);
    if (t > -1)
      this._routes.get(e.method).splice(t, 1);
    else
      throw new h("unregister-route-route-not-registered");
  }
}
let y;
const G = () => (y || (y = new me(), y.addFetchListener(), y.addCacheListener()), y);
function m(s, e, t) {
  let n;
  if (typeof s == "string") {
    const i = new URL(s, location.href), r = ({ url: o }) => o.href === i.href;
    n = new R(r, e, t);
  } else if (s instanceof RegExp)
    n = new pe(s, e, t);
  else if (typeof s == "function")
    n = new R(s, e, t);
  else if (s instanceof R)
    n = s;
  else
    throw new h("unsupported-route-type", {
      moduleName: "workbox-routing",
      funcName: "registerRoute",
      paramName: "capture"
    });
  return G().registerRoute(n), n;
}
function ge(s, e = []) {
  for (const t of [...s.searchParams.keys()])
    e.some((n) => n.test(t)) && s.searchParams.delete(t);
  return s;
}
function* we(s, { ignoreURLParametersMatching: e = [/^utm_/, /^fbclid$/], directoryIndex: t = "index.html", cleanURLs: n = !0, urlManipulation: a } = {}) {
  const i = new URL(s, location.href);
  i.hash = "", yield i.href;
  const r = ge(i, e);
  if (yield r.href, t && r.pathname.endsWith("/")) {
    const o = new URL(r.href);
    o.pathname += t, yield o.href;
  }
  if (n) {
    const o = new URL(r.href);
    o.pathname += ".html", yield o.href;
  }
  if (a) {
    const o = a({ url: i });
    for (const c of o)
      yield c.href;
  }
}
class ye extends R {
  /**
   * @param {PrecacheController} precacheController A `PrecacheController`
   * instance used to both match requests and respond to fetch events.
   * @param {Object} [options] Options to control how requests are matched
   * against the list of precached URLs.
   * @param {string} [options.directoryIndex=index.html] The `directoryIndex` will
   * check cache entries for a URLs ending with '/' to see if there is a hit when
   * appending the `directoryIndex` value.
   * @param {Array<RegExp>} [options.ignoreURLParametersMatching=[/^utm_/, /^fbclid$/]] An
   * array of regex's to remove search params when looking for a cache match.
   * @param {boolean} [options.cleanURLs=true] The `cleanURLs` option will
   * check the cache for the URL with a `.html` added to the end of the end.
   * @param {workbox-precaching~urlManipulation} [options.urlManipulation]
   * This is a function that should take a URL and return an array of
   * alternative URLs that should be checked for precache matches.
   */
  constructor(e, t) {
    const n = ({ request: a }) => {
      const i = e.getURLsToCacheKeys();
      for (const r of we(a.url, t)) {
        const o = i.get(r);
        if (o) {
          const c = e.getIntegrityForCacheKey(o);
          return { cacheKey: o, integrity: c };
        }
      }
    };
    super(n, e.strategy);
  }
}
function _e(s) {
  const e = H(), t = new ye(e, s);
  m(t);
}
const be = "-precache-", Re = async (s, e = be) => {
  const n = (await self.caches.keys()).filter((a) => a.includes(e) && a.includes(self.registration.scope) && a !== s);
  return await Promise.all(n.map((a) => self.caches.delete(a))), n;
};
function Ce() {
  self.addEventListener("activate", ((s) => {
    const e = C.getPrecacheName();
    s.waitUntil(Re(e).then((t) => {
    }));
  }));
}
function xe(s) {
  H().precache(s);
}
function Ee(s, e) {
  xe(s), _e(e);
}
function Te(s) {
  q.add(s);
}
function $(s) {
  s.then(() => {
  });
}
function ke() {
  self.addEventListener("activate", () => self.clients.claim());
}
function Ue(s) {
  G().setCatchHandler(s);
}
class z extends x {
  /**
   * @private
   * @param {Request|string} request A request to run this strategy for.
   * @param {workbox-strategies.StrategyHandler} handler The event that
   *     triggered the request.
   * @return {Promise<Response>}
   */
  async _handle(e, t) {
    let n = await t.cacheMatch(e), a;
    if (!n)
      try {
        n = await t.fetchAndCachePut(e);
      } catch (i) {
        i instanceof Error && (a = i);
      }
    if (!n)
      throw new h("no-response", { url: e.url, error: a });
    return n;
  }
}
const Q = {
  /**
   * Returns a valid response (to allow caching) if the status is 200 (OK) or
   * 0 (opaque).
   *
   * @param {Object} options
   * @param {Response} options.response
   * @return {Response|null}
   *
   * @private
   */
  cacheWillUpdate: async ({ response: s }) => s.status === 200 || s.status === 0 ? s : null
};
class J extends x {
  /**
   * @param {Object} [options]
   * @param {string} [options.cacheName] Cache name to store and retrieve
   * requests. Defaults to cache names provided by
   * {@link workbox-core.cacheNames}.
   * @param {Array<Object>} [options.plugins] [Plugins]{@link https://developers.google.com/web/tools/workbox/guides/using-plugins}
   * to use in conjunction with this caching strategy.
   * @param {Object} [options.fetchOptions] Values passed along to the
   * [`init`](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters)
   * of [non-navigation](https://github.com/GoogleChrome/workbox/issues/1796)
   * `fetch()` requests made by this strategy.
   * @param {Object} [options.matchOptions] [`CacheQueryOptions`](https://w3c.github.io/ServiceWorker/#dictdef-cachequeryoptions)
   * @param {number} [options.networkTimeoutSeconds] If set, any network requests
   * that fail to respond within the timeout will fallback to the cache.
   *
   * This option can be used to combat
   * "[lie-fi]{@link https://developers.google.com/web/fundamentals/performance/poor-connectivity/#lie-fi}"
   * scenarios.
   */
  constructor(e = {}) {
    super(e), this.plugins.some((t) => "cacheWillUpdate" in t) || this.plugins.unshift(Q), this._networkTimeoutSeconds = e.networkTimeoutSeconds || 0;
  }
  /**
   * @private
   * @param {Request|string} request A request to run this strategy for.
   * @param {workbox-strategies.StrategyHandler} handler The event that
   *     triggered the request.
   * @return {Promise<Response>}
   */
  async _handle(e, t) {
    const n = [], a = [];
    let i;
    if (this._networkTimeoutSeconds) {
      const { id: c, promise: l } = this._getTimeoutPromise({ request: e, logs: n, handler: t });
      i = c, a.push(l);
    }
    const r = this._getNetworkPromise({
      timeoutId: i,
      request: e,
      logs: n,
      handler: t
    });
    a.push(r);
    const o = await t.waitUntil((async () => await t.waitUntil(Promise.race(a)) || // If Promise.race() resolved with null, it might be due to a network
    // timeout + a cache miss. If that were to happen, we'd rather wait until
    // the networkPromise resolves instead of returning null.
    // Note that it's fine to await an already-resolved promise, so we don't
    // have to check to see if it's still "in flight".
    await r)());
    if (!o)
      throw new h("no-response", { url: e.url });
    return o;
  }
  /**
   * @param {Object} options
   * @param {Request} options.request
   * @param {Array} options.logs A reference to the logs array
   * @param {Event} options.event
   * @return {Promise<Response>}
   *
   * @private
   */
  _getTimeoutPromise({ request: e, logs: t, handler: n }) {
    let a;
    return {
      promise: new Promise((r) => {
        a = setTimeout(async () => {
          r(await n.cacheMatch(e));
        }, this._networkTimeoutSeconds * 1e3);
      }),
      id: a
    };
  }
  /**
   * @param {Object} options
   * @param {number|undefined} options.timeoutId
   * @param {Request} options.request
   * @param {Array} options.logs A reference to the logs Array.
   * @param {Event} options.event
   * @return {Promise<Response>}
   *
   * @private
   */
  async _getNetworkPromise({ timeoutId: e, request: t, logs: n, handler: a }) {
    let i, r;
    try {
      r = await a.fetchAndCachePut(t);
    } catch (o) {
      o instanceof Error && (i = o);
    }
    return e && clearTimeout(e), (i || !r) && (r = await a.cacheMatch(t)), r;
  }
}
class Pe extends x {
  /**
   * @param {Object} [options]
   * @param {Array<Object>} [options.plugins] [Plugins]{@link https://developers.google.com/web/tools/workbox/guides/using-plugins}
   * to use in conjunction with this caching strategy.
   * @param {Object} [options.fetchOptions] Values passed along to the
   * [`init`](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters)
   * of [non-navigation](https://github.com/GoogleChrome/workbox/issues/1796)
   * `fetch()` requests made by this strategy.
   * @param {number} [options.networkTimeoutSeconds] If set, any network requests
   * that fail to respond within the timeout will result in a network error.
   */
  constructor(e = {}) {
    super(e), this._networkTimeoutSeconds = e.networkTimeoutSeconds || 0;
  }
  /**
   * @private
   * @param {Request|string} request A request to run this strategy for.
   * @param {workbox-strategies.StrategyHandler} handler The event that
   *     triggered the request.
   * @return {Promise<Response>}
   */
  async _handle(e, t) {
    let n, a;
    try {
      const i = [
        t.fetch(e)
      ];
      if (this._networkTimeoutSeconds) {
        const r = F(this._networkTimeoutSeconds * 1e3);
        i.push(r);
      }
      if (a = await Promise.race(i), !a)
        throw new Error(`Timed out the network response after ${this._networkTimeoutSeconds} seconds.`);
    } catch (i) {
      i instanceof Error && (n = i);
    }
    if (!a)
      throw new h("no-response", { url: e.url, error: n });
    return a;
  }
}
class Le extends x {
  /**
   * @param {Object} [options]
   * @param {string} [options.cacheName] Cache name to store and retrieve
   * requests. Defaults to cache names provided by
   * {@link workbox-core.cacheNames}.
   * @param {Array<Object>} [options.plugins] [Plugins]{@link https://developers.google.com/web/tools/workbox/guides/using-plugins}
   * to use in conjunction with this caching strategy.
   * @param {Object} [options.fetchOptions] Values passed along to the
   * [`init`](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters)
   * of [non-navigation](https://github.com/GoogleChrome/workbox/issues/1796)
   * `fetch()` requests made by this strategy.
   * @param {Object} [options.matchOptions] [`CacheQueryOptions`](https://w3c.github.io/ServiceWorker/#dictdef-cachequeryoptions)
   */
  constructor(e = {}) {
    super(e), this.plugins.some((t) => "cacheWillUpdate" in t) || this.plugins.unshift(Q);
  }
  /**
   * @private
   * @param {Request|string} request A request to run this strategy for.
   * @param {workbox-strategies.StrategyHandler} handler The event that
   *     triggered the request.
   * @return {Promise<Response>}
   */
  async _handle(e, t) {
    const n = t.fetchAndCachePut(e).catch(() => {
    });
    t.waitUntil(n);
    let a = await t.cacheMatch(e), i;
    if (!a) try {
      a = await n;
    } catch (r) {
      r instanceof Error && (i = r);
    }
    if (!a)
      throw new h("no-response", { url: e.url, error: i });
    return a;
  }
}
const De = (s, e) => e.some((t) => s instanceof t);
let K, W;
function Ne() {
  return K || (K = [
    IDBDatabase,
    IDBObjectStore,
    IDBIndex,
    IDBCursor,
    IDBTransaction
  ]);
}
function Se() {
  return W || (W = [
    IDBCursor.prototype.advance,
    IDBCursor.prototype.continue,
    IDBCursor.prototype.continuePrimaryKey
  ]);
}
const Y = /* @__PURE__ */ new WeakMap(), S = /* @__PURE__ */ new WeakMap(), X = /* @__PURE__ */ new WeakMap(), L = /* @__PURE__ */ new WeakMap(), M = /* @__PURE__ */ new WeakMap();
function Ie(s) {
  const e = new Promise((t, n) => {
    const a = () => {
      s.removeEventListener("success", i), s.removeEventListener("error", r);
    }, i = () => {
      t(f(s.result)), a();
    }, r = () => {
      n(s.error), a();
    };
    s.addEventListener("success", i), s.addEventListener("error", r);
  });
  return e.then((t) => {
    t instanceof IDBCursor && Y.set(t, s);
  }).catch(() => {
  }), M.set(e, s), e;
}
function Me(s) {
  if (S.has(s))
    return;
  const e = new Promise((t, n) => {
    const a = () => {
      s.removeEventListener("complete", i), s.removeEventListener("error", r), s.removeEventListener("abort", r);
    }, i = () => {
      t(), a();
    }, r = () => {
      n(s.error || new DOMException("AbortError", "AbortError")), a();
    };
    s.addEventListener("complete", i), s.addEventListener("error", r), s.addEventListener("abort", r);
  });
  S.set(s, e);
}
let I = {
  get(s, e, t) {
    if (s instanceof IDBTransaction) {
      if (e === "done")
        return S.get(s);
      if (e === "objectStoreNames")
        return s.objectStoreNames || X.get(s);
      if (e === "store")
        return t.objectStoreNames[1] ? void 0 : t.objectStore(t.objectStoreNames[0]);
    }
    return f(s[e]);
  },
  set(s, e, t) {
    return s[e] = t, !0;
  },
  has(s, e) {
    return s instanceof IDBTransaction && (e === "done" || e === "store") ? !0 : e in s;
  }
};
function Ae(s) {
  I = s(I);
}
function ve(s) {
  return s === IDBDatabase.prototype.transaction && !("objectStoreNames" in IDBTransaction.prototype) ? function(e, ...t) {
    const n = s.call(D(this), e, ...t);
    return X.set(n, e.sort ? e.sort() : [e]), f(n);
  } : Se().includes(s) ? function(...e) {
    return s.apply(D(this), e), f(Y.get(this));
  } : function(...e) {
    return f(s.apply(D(this), e));
  };
}
function Oe(s) {
  return typeof s == "function" ? ve(s) : (s instanceof IDBTransaction && Me(s), De(s, Ne()) ? new Proxy(s, I) : s);
}
function f(s) {
  if (s instanceof IDBRequest)
    return Ie(s);
  if (L.has(s))
    return L.get(s);
  const e = Oe(s);
  return e !== s && (L.set(s, e), M.set(e, s)), e;
}
const D = (s) => M.get(s);
function Ke(s, e, { blocked: t, upgrade: n, blocking: a, terminated: i } = {}) {
  const r = indexedDB.open(s, e), o = f(r);
  return n && r.addEventListener("upgradeneeded", (c) => {
    n(f(r.result), c.oldVersion, c.newVersion, f(r.transaction), c);
  }), t && r.addEventListener("blocked", (c) => t(
    // Casting due to https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1405
    c.oldVersion,
    c.newVersion,
    c
  )), o.then((c) => {
    i && c.addEventListener("close", () => i()), a && c.addEventListener("versionchange", (l) => a(l.oldVersion, l.newVersion, l));
  }).catch(() => {
  }), o;
}
function We(s, { blocked: e } = {}) {
  const t = indexedDB.deleteDatabase(s);
  return e && t.addEventListener("blocked", (n) => e(
    // Casting due to https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1405
    n.oldVersion,
    n
  )), f(t).then(() => {
  });
}
const Be = ["get", "getKey", "getAll", "getAllKeys", "count"], je = ["put", "add", "delete", "clear"], N = /* @__PURE__ */ new Map();
function B(s, e) {
  if (!(s instanceof IDBDatabase && !(e in s) && typeof e == "string"))
    return;
  if (N.get(e))
    return N.get(e);
  const t = e.replace(/FromIndex$/, ""), n = e !== t, a = je.includes(t);
  if (
    // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
    !(t in (n ? IDBIndex : IDBObjectStore).prototype) || !(a || Be.includes(t))
  )
    return;
  const i = async function(r, ...o) {
    const c = this.transaction(r, a ? "readwrite" : "readonly");
    let l = c.store;
    return n && (l = l.index(o.shift())), (await Promise.all([
      l[t](...o),
      a && c.done
    ]))[0];
  };
  return N.set(e, i), i;
}
Ae((s) => ({
  ...s,
  get: (e, t, n) => B(e, t) || s.get(e, t, n),
  has: (e, t) => !!B(e, t) || s.has(e, t)
}));
try {
  self["workbox:expiration:7.3.0"] && _();
} catch {
}
const qe = "workbox-expiration", b = "cache-entries", j = (s) => {
  const e = new URL(s, location.href);
  return e.hash = "", e.href;
};
class Fe {
  /**
   *
   * @param {string} cacheName
   *
   * @private
   */
  constructor(e) {
    this._db = null, this._cacheName = e;
  }
  /**
   * Performs an upgrade of indexedDB.
   *
   * @param {IDBPDatabase<CacheDbSchema>} db
   *
   * @private
   */
  _upgradeDb(e) {
    const t = e.createObjectStore(b, { keyPath: "id" });
    t.createIndex("cacheName", "cacheName", { unique: !1 }), t.createIndex("timestamp", "timestamp", { unique: !1 });
  }
  /**
   * Performs an upgrade of indexedDB and deletes deprecated DBs.
   *
   * @param {IDBPDatabase<CacheDbSchema>} db
   *
   * @private
   */
  _upgradeDbAndDeleteOldDbs(e) {
    this._upgradeDb(e), this._cacheName && We(this._cacheName);
  }
  /**
   * @param {string} url
   * @param {number} timestamp
   *
   * @private
   */
  async setTimestamp(e, t) {
    e = j(e);
    const n = {
      url: e,
      timestamp: t,
      cacheName: this._cacheName,
      // Creating an ID from the URL and cache name won't be necessary once
      // Edge switches to Chromium and all browsers we support work with
      // array keyPaths.
      id: this._getId(e)
    }, i = (await this.getDb()).transaction(b, "readwrite", {
      durability: "relaxed"
    });
    await i.store.put(n), await i.done;
  }
  /**
   * Returns the timestamp stored for a given URL.
   *
   * @param {string} url
   * @return {number | undefined}
   *
   * @private
   */
  async getTimestamp(e) {
    const n = await (await this.getDb()).get(b, this._getId(e));
    return n == null ? void 0 : n.timestamp;
  }
  /**
   * Iterates through all the entries in the object store (from newest to
   * oldest) and removes entries once either `maxCount` is reached or the
   * entry's timestamp is less than `minTimestamp`.
   *
   * @param {number} minTimestamp
   * @param {number} maxCount
   * @return {Array<string>}
   *
   * @private
   */
  async expireEntries(e, t) {
    const n = await this.getDb();
    let a = await n.transaction(b).store.index("timestamp").openCursor(null, "prev");
    const i = [];
    let r = 0;
    for (; a; ) {
      const c = a.value;
      c.cacheName === this._cacheName && (e && c.timestamp < e || t && r >= t ? i.push(a.value) : r++), a = await a.continue();
    }
    const o = [];
    for (const c of i)
      await n.delete(b, c.id), o.push(c.url);
    return o;
  }
  /**
   * Takes a URL and returns an ID that will be unique in the object store.
   *
   * @param {string} url
   * @return {string}
   *
   * @private
   */
  _getId(e) {
    return this._cacheName + "|" + j(e);
  }
  /**
   * Returns an open connection to the database.
   *
   * @private
   */
  async getDb() {
    return this._db || (this._db = await Ke(qe, 1, {
      upgrade: this._upgradeDbAndDeleteOldDbs.bind(this)
    })), this._db;
  }
}
class He {
  /**
   * To construct a new CacheExpiration instance you must provide at least
   * one of the `config` properties.
   *
   * @param {string} cacheName Name of the cache to apply restrictions to.
   * @param {Object} config
   * @param {number} [config.maxEntries] The maximum number of entries to cache.
   * Entries used the least will be removed as the maximum is reached.
   * @param {number} [config.maxAgeSeconds] The maximum age of an entry before
   * it's treated as stale and removed.
   * @param {Object} [config.matchOptions] The [`CacheQueryOptions`](https://developer.mozilla.org/en-US/docs/Web/API/Cache/delete#Parameters)
   * that will be used when calling `delete()` on the cache.
   */
  constructor(e, t = {}) {
    this._isRunning = !1, this._rerunRequested = !1, this._maxEntries = t.maxEntries, this._maxAgeSeconds = t.maxAgeSeconds, this._matchOptions = t.matchOptions, this._cacheName = e, this._timestampModel = new Fe(e);
  }
  /**
   * Expires entries for the given cache and given criteria.
   */
  async expireEntries() {
    if (this._isRunning) {
      this._rerunRequested = !0;
      return;
    }
    this._isRunning = !0;
    const e = this._maxAgeSeconds ? Date.now() - this._maxAgeSeconds * 1e3 : 0, t = await this._timestampModel.expireEntries(e, this._maxEntries), n = await self.caches.open(this._cacheName);
    for (const a of t)
      await n.delete(a, this._matchOptions);
    this._isRunning = !1, this._rerunRequested && (this._rerunRequested = !1, $(this.expireEntries()));
  }
  /**
   * Update the timestamp for the given URL. This ensures the when
   * removing entries based on maximum entries, most recently used
   * is accurate or when expiring, the timestamp is up-to-date.
   *
   * @param {string} url
   */
  async updateTimestamp(e) {
    await this._timestampModel.setTimestamp(e, Date.now());
  }
  /**
   * Can be used to check if a URL has expired or not before it's used.
   *
   * This requires a look up from IndexedDB, so can be slow.
   *
   * Note: This method will not remove the cached entry, call
   * `expireEntries()` to remove indexedDB and Cache entries.
   *
   * @param {string} url
   * @return {boolean}
   */
  async isURLExpired(e) {
    if (this._maxAgeSeconds) {
      const t = await this._timestampModel.getTimestamp(e), n = Date.now() - this._maxAgeSeconds * 1e3;
      return t !== void 0 ? t < n : !0;
    } else
      return !1;
  }
  /**
   * Removes the IndexedDB object store used to keep track of cache expiration
   * metadata.
   */
  async delete() {
    this._rerunRequested = !1, await this._timestampModel.expireEntries(1 / 0);
  }
}
class E {
  /**
   * @param {ExpirationPluginOptions} config
   * @param {number} [config.maxEntries] The maximum number of entries to cache.
   * Entries used the least will be removed as the maximum is reached.
   * @param {number} [config.maxAgeSeconds] The maximum age of an entry before
   * it's treated as stale and removed.
   * @param {Object} [config.matchOptions] The [`CacheQueryOptions`](https://developer.mozilla.org/en-US/docs/Web/API/Cache/delete#Parameters)
   * that will be used when calling `delete()` on the cache.
   * @param {boolean} [config.purgeOnQuotaError] Whether to opt this cache in to
   * automatic deletion if the available storage quota has been exceeded.
   */
  constructor(e = {}) {
    this.cachedResponseWillBeUsed = async ({ event: t, request: n, cacheName: a, cachedResponse: i }) => {
      if (!i)
        return null;
      const r = this._isResponseDateFresh(i), o = this._getCacheExpiration(a);
      $(o.expireEntries());
      const c = o.updateTimestamp(n.url);
      if (t)
        try {
          t.waitUntil(c);
        } catch {
        }
      return r ? i : null;
    }, this.cacheDidUpdate = async ({ cacheName: t, request: n }) => {
      const a = this._getCacheExpiration(t);
      await a.updateTimestamp(n.url), await a.expireEntries();
    }, this._config = e, this._maxAgeSeconds = e.maxAgeSeconds, this._cacheExpirations = /* @__PURE__ */ new Map(), e.purgeOnQuotaError && Te(() => this.deleteCacheAndMetadata());
  }
  /**
   * A simple helper method to return a CacheExpiration instance for a given
   * cache name.
   *
   * @param {string} cacheName
   * @return {CacheExpiration}
   *
   * @private
   */
  _getCacheExpiration(e) {
    if (e === C.getRuntimeName())
      throw new h("expire-custom-caches-only");
    let t = this._cacheExpirations.get(e);
    return t || (t = new He(e, this._config), this._cacheExpirations.set(e, t)), t;
  }
  /**
   * @param {Response} cachedResponse
   * @return {boolean}
   *
   * @private
   */
  _isResponseDateFresh(e) {
    if (!this._maxAgeSeconds)
      return !0;
    const t = this._getDateHeaderTimestamp(e);
    if (t === null)
      return !0;
    const n = Date.now();
    return t >= n - this._maxAgeSeconds * 1e3;
  }
  /**
   * This method will extract the data header and parse it into a useful
   * value.
   *
   * @param {Response} cachedResponse
   * @return {number|null}
   *
   * @private
   */
  _getDateHeaderTimestamp(e) {
    if (!e.headers.has("date"))
      return null;
    const t = e.headers.get("date"), a = new Date(t).getTime();
    return isNaN(a) ? null : a;
  }
  /**
   * This is a helper method that performs two operations:
   *
   * - Deletes *all* the underlying Cache instances associated with this plugin
   * instance, by calling caches.delete() on your behalf.
   * - Deletes the metadata from IndexedDB used to keep track of expiration
   * details for each Cache instance.
   *
   * When using cache expiration, calling this method is preferable to calling
   * `caches.delete()` directly, since this will ensure that the IndexedDB
   * metadata is also cleanly removed and open IndexedDB instances are deleted.
   *
   * Note that if you're *not* using cache expiration for a given cache, calling
   * `caches.delete()` and passing in the cache's name should be sufficient.
   * There is no Workbox-specific method needed for cleanup in that case.
   */
  async deleteCacheAndMetadata() {
    for (const [e, t] of this._cacheExpirations)
      await self.caches.delete(e), await t.delete();
    this._cacheExpirations = /* @__PURE__ */ new Map();
  }
}
Ce();
Ee(self.__WB_MANIFEST);
self.skipWaiting();
ke();
m(
  ({ url: s, request: e }) => s.origin === self.location.origin && e.method === "GET" && (s.pathname === "/api/cadet/my-grades" || s.pathname === "/api/cadet/my-merit-logs"),
  new Pe()
);
m(
  ({ url: s, request: e }) => s.origin === self.location.origin && e.method === "GET" && s.pathname.startsWith("/api/"),
  new J({
    cacheName: "api-cache",
    networkTimeoutSeconds: 8,
    plugins: [
      new E({
        maxEntries: 100,
        maxAgeSeconds: 300
        // 5 minutes
      })
    ]
  })
);
m(
  ({ request: s }) => s.destination === "image",
  new z({
    cacheName: "images-cache",
    plugins: [
      new E({
        maxEntries: 200,
        maxAgeSeconds: 720 * 60 * 60
        // 30 days
      })
    ]
  })
);
m(
  ({ request: s }) => s.destination === "style" || s.destination === "script",
  new Le({
    cacheName: "static-resources",
    plugins: [
      new E({
        maxEntries: 50,
        maxAgeSeconds: 10080 * 60
        // 7 days
      })
    ]
  })
);
m(
  ({ request: s }) => s.destination === "font",
  new z({
    cacheName: "fonts-cache",
    plugins: [
      new E({
        maxEntries: 30,
        maxAgeSeconds: 365 * 24 * 60 * 60
        // 1 year
      })
    ]
  })
);
m(
  ({ request: s }) => s.mode === "navigate",
  new J({
    cacheName: "pages-cache",
    plugins: [
      new E({
        maxEntries: 50,
        maxAgeSeconds: 1440 * 60
        // 1 day
      })
    ]
  })
);
self.addEventListener("sync", (s) => {
  s.tag === "background-sync" && s.waitUntil(Ve());
});
Ue(async ({ event: s }) => {
  const e = s.request;
  try {
    if (e.mode === "navigate")
      return new Response("You appear to be offline. Please check your connection.", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=UTF-8" }
      });
    const t = new URL(e.url);
    if (e.method === "GET" && t.origin === self.location.origin && t.pathname.startsWith("/api/"))
      return new Response(JSON.stringify({ ok: !1, offline: !0, message: "Service unavailable (offline or server unreachable)" }), {
        status: 503,
        headers: { "Content-Type": "application/json" }
      });
  } catch {
  }
  return Response.error();
});
async function Ve() {
  try {
    const s = await caches.open("failed-requests"), e = await s.keys();
    for (const t of e)
      try {
        await fetch(t), await s.delete(t);
      } catch {
        console.log("Background sync failed for:", t.url);
      }
  } catch (s) {
    console.log("Background sync error:", s);
  }
}
self.addEventListener("fetch", (s) => {
  const { request: e } = s;
  if (e.destination === "image") {
    const t = new URL(e.url);
    if (t.hostname.includes("cloudinary.com")) {
      const n = e.headers.get("user-agent") || "";
      if (/Mobile|Android|iPhone|iPad/.test(n) && !t.pathname.includes("q_auto")) {
        t.pathname = t.pathname.replace("/upload/", "/upload/q_auto,f_auto,dpr_auto/");
        const i = new Request(t.toString(), {
          method: e.method,
          headers: e.headers,
          body: e.body,
          mode: e.mode,
          credentials: e.credentials,
          cache: e.cache,
          redirect: e.redirect,
          referrer: e.referrer
        });
        s.respondWith(fetch(i));
        return;
      }
    }
  }
  !self.navigator.onLine && e.method === "GET" && s.respondWith(
    caches.match(e).then((t) => t || (e.mode === "navigate" ? new Response(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Offline - ROTC GSMS</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body { font-family: system-ui; text-align: center; padding: 2rem; }
                .offline-icon { font-size: 4rem; margin-bottom: 1rem; }
                .offline-message { color: #666; margin-bottom: 2rem; }
                .retry-button { 
                  background: #354f32; color: white; border: none; 
                  padding: 0.75rem 1.5rem; border-radius: 0.5rem; 
                  font-size: 1rem; cursor: pointer; 
                }
              </style>
            </head>
            <body>
              <div class="offline-icon">📱</div>
              <h1>You're Offline</h1>
              <p class="offline-message">
                Please check your internet connection and try again.
              </p>
              <button class="retry-button" onclick="window.location.reload()">
                Retry
              </button>
            </body>
            </html>
          `, {
      status: 200,
      headers: { "Content-Type": "text/html" }
    }) : new Response("Offline", { status: 503 })))
  );
});
self.addEventListener("push", (s) => {
  const e = s.data ? s.data.json() : {}, t = e.title || "ROTC GSMS", n = {
    body: e.body || "New notification",
    icon: e.icon || "/pwa-192x192.webp",
    badge: "/pwa-192x192.webp",
    vibrate: [100, 50, 100],
    data: {
      url: e.url || "/",
      timestamp: Date.now()
    },
    actions: e.actions || [],
    requireInteraction: e.requireInteraction || !1,
    silent: e.silent || !1
  };
  s.waitUntil(self.registration.showNotification(t, n));
});
self.addEventListener("notificationclick", (s) => {
  if (s.notification.close(), s.action)
    switch (s.action) {
      case "view":
        s.waitUntil(clients.openWindow(s.notification.data.url));
        break;
      case "dismiss":
        break;
      default:
        s.waitUntil(clients.openWindow(s.notification.data.url));
    }
  else
    s.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: !0 }).then((e) => {
        for (let t of e)
          if (t.url.includes(self.location.origin) && "focus" in t)
            return t.focus().then((n) => {
              if (n.navigate)
                return n.navigate(s.notification.data.url);
            });
        if (clients.openWindow)
          return clients.openWindow(s.notification.data.url);
      })
    );
});
self.addEventListener("message", (s) => {
  s.data && s.data.type === "SKIP_WAITING" && self.skipWaiting(), s.data && s.data.type === "GET_VERSION" && s.ports[0].postMessage({ version: "1.0.0" }), s.data && s.data.type === "CACHE_URLS" && s.waitUntil(
    caches.open("runtime-cache").then((e) => e.addAll(s.data.urls))
  );
});
