/**
 * Cross-browser testing utilities for mobile responsiveness
 * Provides tools for testing mobile functionality across different browsers and devices
 */

import { PlatformDetector } from './performance';

/**
 * Browser compatibility detector and tester
 */
export const BrowserCompatibility = {
  /**
   * Detect current browser and version
   * @returns {Object} Browser information
   */
  detectBrowser: () => {
    const userAgent = navigator.userAgent;
    const platform = PlatformDetector.getPlatform();
    
    let browser = 'unknown';
    let version = 'unknown';
    let engine = 'unknown';

    // Detect browser
    if (userAgent.includes('Chrome') && !userAgent.includes('Edge')) {
      browser = 'chrome';
      const match = userAgent.match(/Chrome\/(\d+)/);
      version = match ? match[1] : 'unknown';
      engine = 'blink';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      browser = 'safari';
      const match = userAgent.match(/Version\/(\d+)/);
      version = match ? match[1] : 'unknown';
      engine = 'webkit';
    } else if (userAgent.includes('Firefox')) {
      browser = 'firefox';
      const match = userAgent.match(/Firefox\/(\d+)/);
      version = match ? match[1] : 'unknown';
      engine = 'gecko';
    } else if (userAgent.includes('Edge')) {
      browser = 'edge';
      const match = userAgent.match(/Edge\/(\d+)/);
      version = match ? match[1] : 'unknown';
      engine = 'blink';
    }

    return {
      browser,
      version: parseInt(version),
      engine,
      platform: platform.platform,
      isMobile: platform.isMobile,
      isIOS: platform.isIOS,
      isAndroid: platform.isAndroid,
      userAgent
    };
  },

  /**
   * Test feature support across browsers
   * @returns {Object} Feature support matrix
   */
  testFeatureSupport: () => {
    const features = {
      // CSS Features
      cssGrid: CSS.supports('display', 'grid'),
      cssFlexbox: CSS.supports('display', 'flex'),
      cssCustomProperties: CSS.supports('--test', 'value'),
      cssBackdropFilter: CSS.supports('backdrop-filter', 'blur(1px)'),
      cssSafeArea: CSS.supports('padding', 'env(safe-area-inset-top)'),
      cssAspectRatio: CSS.supports('aspect-ratio', '1/1'),
      cssContainerQueries: CSS.supports('container-type', 'inline-size'),
      
      // JavaScript APIs
      intersectionObserver: 'IntersectionObserver' in window,
      resizeObserver: 'ResizeObserver' in window,
      performanceObserver: 'PerformanceObserver' in window,
      serviceWorker: 'serviceWorker' in navigator,
      pushManager: 'PushManager' in window,
      
      // Touch and Gesture APIs
      touchEvents: 'ontouchstart' in window,
      pointerEvents: 'PointerEvent' in window,
      gestureEvents: 'ongesturestart' in window,
      
      // Storage APIs
      localStorage: 'localStorage' in window,
      sessionStorage: 'sessionStorage' in window,
      indexedDB: 'indexedDB' in window,
      
      // Media APIs
      webGL: (() => {
        try {
          if (window.__rgms_webgl_supported !== undefined) return window.__rgms_webgl_supported;
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl', { preserveDrawingBuffer: false, failIfMajorPerformanceCaveat: true }) 
                 || canvas.getContext('experimental-webgl', { preserveDrawingBuffer: false });
          window.__rgms_webgl_supported = !!gl;
          try {
            if (gl) {
              const lose = gl.getExtension('WEBGL_lose_context');
              if (lose && lose.loseContext) lose.loseContext();
            }
          } catch {}
          return window.__rgms_webgl_supported;
        } catch (e) {
          window.__rgms_webgl_supported = false;
          return false;
        }
      })(),
      webRTC: 'RTCPeerConnection' in window,
      
      // Network APIs
      fetch: 'fetch' in window,
      webSockets: 'WebSocket' in window,
      
      // Device APIs
      geolocation: 'geolocation' in navigator,
      vibration: 'vibrate' in navigator,
      battery: 'getBattery' in navigator,
      deviceOrientation: 'DeviceOrientationEvent' in window,
      deviceMotion: 'DeviceMotionEvent' in window
    };

    return features;
  },

  /**
   * Test gesture support
   * @returns {Object} Gesture support information
   */
  testGestureSupport: () => {
    return {
      touch: 'ontouchstart' in window,
      pointer: 'PointerEvent' in window,
      mouse: 'onmousedown' in window,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      gestures: {
        tap: true, // Always supported
        doubleTap: 'ontouchstart' in window,
        swipe: 'ontouchstart' in window,
        pinch: 'ontouchstart' in window && navigator.maxTouchPoints >= 2,
        rotate: 'ongesturestart' in window
      }
    };
  },

  /**
   * Test viewport and safe area support
   * @returns {Object} Viewport support information
   */
  testViewportSupport: () => {
    const hasVisualViewport = 'visualViewport' in window;
    const hasSafeArea = CSS.supports('padding', 'env(safe-area-inset-top)');
    
    return {
      visualViewport: hasVisualViewport,
      safeArea: hasSafeArea,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      devicePixelRatio: window.devicePixelRatio || 1,
      orientation: window.screen.orientation?.type || 'unknown'
    };
  },

  /**
   * Generate comprehensive compatibility report
   * @returns {Object} Full compatibility report
   */
  generateCompatibilityReport: () => {
    const browser = BrowserCompatibility.detectBrowser();
    const features = BrowserCompatibility.testFeatureSupport();
    const gestures = BrowserCompatibility.testGestureSupport();
    const viewport = BrowserCompatibility.testViewportSupport();

    return {
      browser,
      features,
      gestures,
      viewport,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    };
  }
};

/**
 * Cross-browser testing suite
 */
export const CrossBrowserTestSuite = {
  /**
   * Run all cross-browser tests
   * @returns {Object} Test results
   */
  runAllTests: () => {
    const results = {
      browser: BrowserCompatibility.detectBrowser(),
      compatibility: BrowserCompatibility.generateCompatibilityReport(),
      responsiveTests: CrossBrowserTestSuite.testResponsiveFeatures(),
      touchTests: CrossBrowserTestSuite.testTouchFeatures(),
      performanceTests: CrossBrowserTestSuite.testPerformanceFeatures(),
      passed: 0,
      failed: 0,
      warnings: 0,
      timestamp: new Date().toISOString()
    };

    // Count results
    const allTests = [
      ...results.responsiveTests.tests,
      ...results.touchTests.tests,
      ...results.performanceTests.tests
    ];

    allTests.forEach(test => {
      if (test.status === 'passed') results.passed++;
      else if (test.status === 'failed') results.failed++;
      else if (test.status === 'warning') results.warnings++;
    });

    results.totalTests = allTests.length;
    results.successRate = (results.passed / results.totalTests) * 100;

    return results;
  },

  /**
   * Test responsive features
   * @returns {Object} Responsive test results
   */
  testResponsiveFeatures: () => {
    const tests = [];

    // Test CSS Grid support
    tests.push({
      name: 'CSS Grid Support',
      status: CSS.supports('display', 'grid') ? 'passed' : 'failed',
      message: CSS.supports('display', 'grid') ? 
        'CSS Grid is supported' : 
        'CSS Grid is not supported, fallback to flexbox'
    });

    // Test CSS Flexbox support
    tests.push({
      name: 'CSS Flexbox Support',
      status: CSS.supports('display', 'flex') ? 'passed' : 'failed',
      message: CSS.supports('display', 'flex') ? 
        'CSS Flexbox is supported' : 
        'CSS Flexbox is not supported'
    });

    // Test CSS Custom Properties
    tests.push({
      name: 'CSS Custom Properties',
      status: CSS.supports('--test', 'value') ? 'passed' : 'warning',
      message: CSS.supports('--test', 'value') ? 
        'CSS Custom Properties are supported' : 
        'CSS Custom Properties not supported, using fallback values'
    });

    // Test Safe Area support
    tests.push({
      name: 'Safe Area Insets',
      status: CSS.supports('padding', 'env(safe-area-inset-top)') ? 'passed' : 'warning',
      message: CSS.supports('padding', 'env(safe-area-inset-top)') ? 
        'Safe area insets are supported' : 
        'Safe area insets not supported, using default padding'
    });

    // Test viewport units
    tests.push({
      name: 'Viewport Units',
      status: CSS.supports('width', '100vw') ? 'passed' : 'failed',
      message: CSS.supports('width', '100vw') ? 
        'Viewport units are supported' : 
        'Viewport units not supported'
    });

    // Test media queries
    tests.push({
      name: 'Media Queries',
      status: window.matchMedia ? 'passed' : 'failed',
      message: window.matchMedia ? 
        'Media queries are supported' : 
        'Media queries not supported'
    });

    return {
      category: 'Responsive Features',
      tests,
      passed: tests.filter(t => t.status === 'passed').length,
      failed: tests.filter(t => t.status === 'failed').length,
      warnings: tests.filter(t => t.status === 'warning').length
    };
  },

  /**
   * Test touch features
   * @returns {Object} Touch test results
   */
  testTouchFeatures: () => {
    const tests = [];

    // Test touch events
    tests.push({
      name: 'Touch Events',
      status: 'ontouchstart' in window ? 'passed' : 'warning',
      message: 'ontouchstart' in window ? 
        'Touch events are supported' : 
        'Touch events not supported, using mouse events'
    });

    // Test pointer events
    tests.push({
      name: 'Pointer Events',
      status: 'PointerEvent' in window ? 'passed' : 'warning',
      message: 'PointerEvent' in window ? 
        'Pointer events are supported' : 
        'Pointer events not supported, using touch/mouse events'
    });

    // Test multi-touch
    tests.push({
      name: 'Multi-touch Support',
      status: navigator.maxTouchPoints >= 2 ? 'passed' : 'warning',
      message: navigator.maxTouchPoints >= 2 ? 
        `Multi-touch supported (${navigator.maxTouchPoints} points)` : 
        'Multi-touch may not be supported'
    });

    // Test gesture events
    tests.push({
      name: 'Gesture Events',
      status: 'ongesturestart' in window ? 'passed' : 'warning',
      message: 'ongesturestart' in window ? 
        'Gesture events are supported' : 
        'Gesture events not supported, using touch events'
    });

    // Test vibration API
    tests.push({
      name: 'Vibration API',
      status: 'vibrate' in navigator ? 'passed' : 'warning',
      message: 'vibrate' in navigator ? 
        'Vibration API is supported' : 
        'Vibration API not supported'
    });

    return {
      category: 'Touch Features',
      tests,
      passed: tests.filter(t => t.status === 'passed').length,
      failed: tests.filter(t => t.status === 'failed').length,
      warnings: tests.filter(t => t.status === 'warning').length
    };
  },

  /**
   * Test performance features
   * @returns {Object} Performance test results
   */
  testPerformanceFeatures: () => {
    const tests = [];

    // Test Intersection Observer
    tests.push({
      name: 'Intersection Observer',
      status: 'IntersectionObserver' in window ? 'passed' : 'warning',
      message: 'IntersectionObserver' in window ? 
        'Intersection Observer is supported' : 
        'Intersection Observer not supported, using scroll events'
    });

    // Test Resize Observer
    tests.push({
      name: 'Resize Observer',
      status: 'ResizeObserver' in window ? 'passed' : 'warning',
      message: 'ResizeObserver' in window ? 
        'Resize Observer is supported' : 
        'Resize Observer not supported, using resize events'
    });

    // Test Service Worker
    tests.push({
      name: 'Service Worker',
      status: 'serviceWorker' in navigator ? 'passed' : 'warning',
      message: 'serviceWorker' in navigator ? 
        'Service Worker is supported' : 
        'Service Worker not supported, offline features unavailable'
    });

    // Test requestAnimationFrame
    tests.push({
      name: 'Request Animation Frame',
      status: 'requestAnimationFrame' in window ? 'passed' : 'failed',
      message: 'requestAnimationFrame' in window ? 
        'requestAnimationFrame is supported' : 
        'requestAnimationFrame not supported'
    });

    // Test Performance API
    tests.push({
      name: 'Performance API',
      status: 'performance' in window ? 'passed' : 'warning',
      message: 'performance' in window ? 
        'Performance API is supported' : 
        'Performance API not supported, metrics unavailable'
    });

    // Test WebGL
    tests.push({
      name: 'WebGL',
      status: (() => (window.__rgms_webgl_supported ? 'passed' : 'warning'))(),
      message: (() => (window.__rgms_webgl_supported ? 'WebGL is supported' : 'WebGL not supported'))()
    });

    return {
      category: 'Performance Features',
      tests,
      passed: tests.filter(t => t.status === 'passed').length,
      failed: tests.filter(t => t.status === 'failed').length,
      warnings: tests.filter(t => t.status === 'warning').length
    };
  },

  /**
   * Test specific browser compatibility
   * @param {string} feature - Feature to test
   * @returns {Object} Test result
   */
  testFeature: (feature) => {
    const features = BrowserCompatibility.testFeatureSupport();
    return {
      feature,
      supported: features[feature] || false,
      browser: BrowserCompatibility.detectBrowser()
    };
  },

  /**
   * Generate test report
   * @returns {string} HTML report
   */
  generateTestReport: () => {
    const results = CrossBrowserTestSuite.runAllTests();
    
    let report = `
      <div class="cross-browser-test-report">
        <h2>Cross-Browser Test Report</h2>
        <div class="summary">
          <p><strong>Browser:</strong> ${results.browser.browser} ${results.browser.version}</p>
          <p><strong>Platform:</strong> ${results.browser.platform}</p>
          <p><strong>Total Tests:</strong> ${results.totalTests}</p>
          <p><strong>Passed:</strong> ${results.passed}</p>
          <p><strong>Failed:</strong> ${results.failed}</p>
          <p><strong>Warnings:</strong> ${results.warnings}</p>
          <p><strong>Success Rate:</strong> ${results.successRate.toFixed(2)}%</p>
        </div>
        
        <div class="test-categories">
          <h3>Responsive Features</h3>
          ${CrossBrowserTestSuite.formatTestCategory(results.responsiveTests)}
          
          <h3>Touch Features</h3>
          ${CrossBrowserTestSuite.formatTestCategory(results.touchTests)}
          
          <h3>Performance Features</h3>
          ${CrossBrowserTestSuite.formatTestCategory(results.performanceTests)}
        </div>
      </div>
    `;
    
    return report;
  },

  /**
   * Format test category for report
   * @param {Object} category - Test category
   * @returns {string} Formatted HTML
   */
  formatTestCategory: (category) => {
    let html = '<ul class="test-list">';
    
    category.tests.forEach(test => {
      const statusClass = test.status === 'passed' ? 'success' : 
                         test.status === 'failed' ? 'error' : 'warning';
      html += `
        <li class="test-item ${statusClass}">
          <strong>${test.name}:</strong> ${test.message}
        </li>
      `;
    });
    
    html += '</ul>';
    return html;
  }
};

/**
 * Mobile browser testing utilities
 */
export const MobileBrowserTesting = {
  /**
   * Test mobile-specific features
   * @returns {Object} Mobile test results
   */
  testMobileFeatures: () => {
    const platform = PlatformDetector.getPlatform();
    
    return {
      isMobile: platform.isMobile,
      isIOS: platform.isIOS,
      isAndroid: platform.isAndroid,
      touchSupport: 'ontouchstart' in window,
      orientationSupport: 'orientation' in window.screen,
      devicePixelRatio: window.devicePixelRatio || 1,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        orientation: window.screen.orientation?.type || 'unknown'
      },
      safeArea: CSS.supports('padding', 'env(safe-area-inset-top)'),
      features: BrowserCompatibility.testFeatureSupport()
    };
  },

  /**
   * Test responsive breakpoints
   * @returns {Object} Breakpoint test results
   */
  testBreakpoints: () => {
    const breakpoints = {
      xs: 0,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
      '2xl': 1536
    };

    const currentWidth = window.innerWidth;
    let currentBreakpoint = 'xs';

    Object.entries(breakpoints).forEach(([name, width]) => {
      if (currentWidth >= width) {
        currentBreakpoint = name;
      }
    });

    return {
      currentWidth,
      currentBreakpoint,
      breakpoints,
      isMobile: currentWidth < 768,
      isTablet: currentWidth >= 768 && currentWidth < 1024,
      isDesktop: currentWidth >= 1024
    };
  },

  /**
   * Test orientation changes
   * @param {Function} callback - Callback function
   * @returns {Function} Cleanup function
   */
  testOrientationChange: (callback) => {
    const handleOrientationChange = () => {
      const orientation = window.screen.orientation?.type || 
                         (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
      
      callback({
        orientation,
        width: window.innerWidth,
        height: window.innerHeight,
        timestamp: Date.now()
      });
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    // Return cleanup function
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  },

  /**
   * Test viewport changes
   * @param {Function} callback - Callback function
   * @returns {Function} Cleanup function
   */
  testViewportChange: (callback) => {
    let lastWidth = window.innerWidth;
    let lastHeight = window.innerHeight;

    const handleResize = () => {
      const currentWidth = window.innerWidth;
      const currentHeight = window.innerHeight;

      if (currentWidth !== lastWidth || currentHeight !== lastHeight) {
        callback({
          width: currentWidth,
          height: currentHeight,
          previousWidth: lastWidth,
          previousHeight: lastHeight,
          breakpoint: MobileBrowserTesting.testBreakpoints().currentBreakpoint,
          timestamp: Date.now()
        });

        lastWidth = currentWidth;
        lastHeight = currentHeight;
      }
    };

    window.addEventListener('resize', handleResize);

    // Return cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }
};

export default {
  BrowserCompatibility,
  CrossBrowserTestSuite,
  MobileBrowserTesting
};
