import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Database, Zap, TrendingUp, RefreshCw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Performance Monitoring Dashboard
 * Validates Requirements: 9.5
 */
function PerformanceMonitor() {
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [clearing, setClearing] = useState(false);
    const [optimizing, setOptimizing] = useState(false);

    const fetchMetrics = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/admin/metrics');
            setMetrics(response.data);
        } catch (error) {
            console.error('Error fetching metrics:', error);
            toast.error('Failed to load performance metrics');
        } finally {
            setLoading(false);
        }
    };

    const clearCache = async () => {
        if (!confirm('Are you sure you want to clear all cache? This will temporarily slow down the system until cache is rebuilt.')) {
            return;
        }

        try {
            setClearing(true);
            await axios.post('/api/admin/cache/clear');
            toast.success('Cache cleared successfully');
            fetchMetrics(); // Refresh metrics
        } catch (error) {
            console.error('Error clearing cache:', error);
            toast.error('Failed to clear cache');
        } finally {
            setClearing(false);
        }
    };

    const optimizeDatabase = async () => {
        if (!confirm('Optimize database performance?\n\nThis will:\n- Create missing performance indexes\n- Run pending migrations\n- Clear cache\n\nThis may take a few seconds.')) {
            return;
        }

        try {
            setOptimizing(true);
            const response = await axios.post('/api/admin/force-optimize-db');
            
            if (response.data.success) {
                toast.success(`Database optimized! Created ${response.data.indexesCreated} indexes`);
            } else {
                toast.error(`Optimization completed with errors: ${response.data.errors.join(', ')}`);
            }
            
            fetchMetrics(); // Refresh metrics
        } catch (error) {
            console.error('Error optimizing database:', error);
            toast.error('Failed to optimize database');
        } finally {
            setOptimizing(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchMetrics, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading && !metrics) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const getLatencyColor = (latency) => {
        if (latency < 200) return 'text-green-600';
        if (latency < 500) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getCacheHitRateColor = (rate) => {
        if (rate > 70) return 'text-green-600';
        if (rate > 40) return 'text-yellow-600';
        return 'text-red-600';
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Performance Monitor</h1>
                    <p className="text-gray-600 mt-1">Real-time system performance metrics</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={optimizeDatabase}
                        disabled={optimizing}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                        <Zap className={`w-4 h-4 ${optimizing ? 'animate-pulse' : ''}`} />
                        {optimizing ? 'Optimizing...' : 'Optimize DB'}
                    </button>
                    <button
                        onClick={fetchMetrics}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <button
                        onClick={clearCache}
                        disabled={clearing}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                        <Trash2 className="w-4 h-4" />
                        Clear Cache
                    </button>
                </div>
            </div>

            {metrics && (
                <div className="space-y-6">
                    {/* Overview Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Average Latency */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Avg Response Time</p>
                                    <p className={`text-3xl font-bold ${getLatencyColor(metrics.requests?.avgResponseTime || 0)}`}>
                                        {Math.round(metrics.requests?.avgResponseTime || 0)}ms
                                    </p>
                                </div>
                                <Activity className="w-10 h-10 text-blue-600" />
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                Target: &lt; 500ms
                            </p>
                        </div>

                        {/* Cache Hit Rate */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Cache Hit Rate</p>
                                    <p className={`text-3xl font-bold ${getCacheHitRateColor(metrics.cache?.hitRate || 0)}`}>
                                        {Math.round(metrics.cache?.hitRate || 0)}%
                                    </p>
                                </div>
                                <Zap className="w-10 h-10 text-yellow-600" />
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                {metrics.cache?.hits || 0} hits / {(metrics.cache?.hits || 0) + (metrics.cache?.misses || 0)} total
                            </p>
                        </div>

                        {/* Total Requests */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Total Requests</p>
                                    <p className="text-3xl font-bold text-gray-900">
                                        {metrics.requests?.total || 0}
                                    </p>
                                </div>
                                <TrendingUp className="w-10 h-10 text-green-600" />
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                {metrics.requests?.slowRequests || 0} slow (&gt; 500ms)
                            </p>
                        </div>

                        {/* Database Queries */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Avg Query Time</p>
                                    <p className={`text-3xl font-bold ${getLatencyColor(metrics.database?.avgQueryTime || 0)}`}>
                                        {Math.round(metrics.database?.avgQueryTime || 0)}ms
                                    </p>
                                </div>
                                <Database className="w-10 h-10 text-purple-600" />
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                {metrics.database?.slowQueries || 0} slow (&gt; 200ms)
                            </p>
                        </div>
                    </div>

                    {/* Detailed Metrics */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Request Metrics */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-xl font-semibold mb-4">Request Metrics</h2>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Total Requests</span>
                                    <span className="font-semibold">{metrics.requests?.total || 0}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Average Response Time</span>
                                    <span className="font-semibold">{Math.round(metrics.requests?.avgResponseTime || 0)}ms</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Slow Requests (&gt; 500ms)</span>
                                    <span className="font-semibold text-red-600">{metrics.requests?.slowRequests || 0}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Slow Request Rate</span>
                                    <span className="font-semibold">
                                        {metrics.requests?.total > 0 
                                            ? Math.round((metrics.requests?.slowRequests / metrics.requests?.total) * 100) 
                                            : 0}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Cache Metrics */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-xl font-semibold mb-4">Cache Metrics</h2>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Cache Hits</span>
                                    <span className="font-semibold text-green-600">{metrics.cache?.hits || 0}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Cache Misses</span>
                                    <span className="font-semibold text-red-600">{metrics.cache?.misses || 0}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Hit Rate</span>
                                    <span className={`font-semibold ${getCacheHitRateColor(metrics.cache?.hitRate || 0)}`}>
                                        {Math.round(metrics.cache?.hitRate || 0)}%
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Cached Keys</span>
                                    <span className="font-semibold">{metrics.cache?.keys || 0}</span>
                                </div>
                            </div>
                        </div>

                        {/* Database Metrics */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-xl font-semibold mb-4">Database Metrics</h2>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Total Queries</span>
                                    <span className="font-semibold">{metrics.database?.totalQueries || 0}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Average Query Time</span>
                                    <span className="font-semibold">{Math.round(metrics.database?.avgQueryTime || 0)}ms</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Slow Queries (&gt; 200ms)</span>
                                    <span className="font-semibold text-red-600">{metrics.database?.slowQueries || 0}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Connection Pool</span>
                                    <span className="font-semibold">
                                        {metrics.database?.poolActive || 0} / {metrics.database?.poolMax || 20}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Performance Status */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-xl font-semibold mb-4">Performance Status</h2>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm text-gray-600">Response Time</span>
                                        <span className="text-sm font-semibold">
                                            {metrics.requests?.avgResponseTime < 500 ? 'Good' : 'Needs Improvement'}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div 
                                            className={`h-2 rounded-full ${
                                                metrics.requests?.avgResponseTime < 200 ? 'bg-green-600' :
                                                metrics.requests?.avgResponseTime < 500 ? 'bg-yellow-600' :
                                                'bg-red-600'
                                            }`}
                                            style={{ width: `${Math.min((metrics.requests?.avgResponseTime / 1000) * 100, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm text-gray-600">Cache Efficiency</span>
                                        <span className="text-sm font-semibold">
                                            {metrics.cache?.hitRate > 60 ? 'Excellent' : 
                                             metrics.cache?.hitRate > 40 ? 'Good' : 'Poor'}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div 
                                            className={`h-2 rounded-full ${
                                                metrics.cache?.hitRate > 70 ? 'bg-green-600' :
                                                metrics.cache?.hitRate > 40 ? 'bg-yellow-600' :
                                                'bg-red-600'
                                            }`}
                                            style={{ width: `${metrics.cache?.hitRate || 0}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t">
                                    <p className="text-sm text-gray-600">
                                        Last updated: {new Date().toLocaleTimeString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recommendations */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <h2 className="text-lg font-semibold text-blue-900 mb-3">Performance Recommendations</h2>
                        <ul className="space-y-2 text-sm text-blue-800">
                            {metrics.requests?.avgResponseTime > 500 && (
                                <li>• Response time is above target. Consider running the index migration or upgrading server resources.</li>
                            )}
                            {metrics.cache?.hitRate < 60 && (
                                <li>• Cache hit rate is low. Review cache TTL settings and ensure cache invalidation is working correctly.</li>
                            )}
                            {metrics.database?.slowQueries > 10 && (
                                <li>• High number of slow queries detected. Review query execution plans and ensure indexes are created.</li>
                            )}
                            {metrics.requests?.slowRequests > metrics.requests?.total * 0.1 && (
                                <li>• More than 10% of requests are slow. Consider implementing request deduplication and pagination.</li>
                            )}
                            {(!metrics.requests?.avgResponseTime || metrics.requests?.avgResponseTime < 500) && 
                             metrics.cache?.hitRate > 60 && 
                             metrics.database?.slowQueries < 10 && (
                                <li className="text-green-700">✓ System performance is within acceptable ranges. Keep monitoring for any degradation.</li>
                            )}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PerformanceMonitor;
