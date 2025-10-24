#!/usr/bin/env node

/**
 * CSVデータ変換スクリプト
 * キャッシュされたCSVファイルをJSON/JSファイルに変換
 */

const fs = require('fs');
const path = require('path');

class DataConverter {
    constructor() {
        this.symbols = {
            spot: 'xauusd',
            etf: '1540.jp',
            forex: 'usdjpy',
            // futures: 'gc.f'  // 一時的にコメントアウト
        };

        this.cacheDir = path.join(__dirname, 'cache');
        this.dataDir = path.join(__dirname, 'data');

        // データディレクトリ作成
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    /**
     * 今日の日付を取得（YYYY-MM-DD形式、JST基準）
     */
    getTodayDate() {
        const now = new Date();
        // JSTの日付を取得（UTC+9）
        const jstOffset = 9 * 60; // 9時間（分単位）
        const jstTime = new Date(now.getTime() + jstOffset * 60 * 1000);
        return jstTime.toISOString().split('T')[0];
    }

    /**
     * キャッシュファイルのパス
     */
    getCacheFilePath(symbol) {
        const today = this.getTodayDate();
        return path.join(this.cacheDir, `${symbol}_${today}.csv`);
    }

    /**
     * 最新のキャッシュファイルを取得
     */
    getLatestCacheFile(symbol) {
        const files = fs.readdirSync(this.cacheDir);
        const pattern = new RegExp(`^${symbol.replace(/\./g, '\\.')}_\\d{4}-\\d{2}-\\d{2}\\.csv$`);

        const matchingFiles = files
            .filter(f => pattern.test(f))
            .map(f => ({
                name: f,
                path: path.join(this.cacheDir, f),
                mtime: fs.statSync(path.join(this.cacheDir, f)).mtime
            }))
            .sort((a, b) => b.mtime - a.mtime);

        return matchingFiles.length > 0 ? matchingFiles[0].path : null;
    }

    /**
     * CSVデータをパース
     */
    parseCSV(csvText, symbol, maxDays = 30) {
        const lines = csvText.trim().split('\n');

        if (lines.length < 2) {
            throw new Error('CSV data is empty or invalid');
        }

        const header = lines[0].toLowerCase().split(',');
        const dataLines = lines.slice(1);

        // 最新maxDays分のデータのみ取得（最後のN行を取得）
        const recentLines = dataLines.slice(-maxDays);

        const history = [];
        let latestClose = null;
        let previousClose = null;

        for (let i = 0; i < recentLines.length; i++) {
            const values = recentLines[i].split(',');

            if (values.length < 5) continue;

            const date = values[0];
            const open = parseFloat(values[1]);
            const high = parseFloat(values[2]);
            const low = parseFloat(values[3]);
            const close = parseFloat(values[4]);
            const volume = values[5] ? parseFloat(values[5]) : 0;

            // 無効なデータをスキップ
            if (isNaN(close) || close === 0) continue;

            // 日付を日本時間（JST）の00:00:00として解釈
            const dateObj = new Date(date + 'T00:00:00+09:00');

            history.push({
                date: date,
                timestamp: Math.floor(dateObj.getTime() / 1000),
                open: this.formatNumber(open),
                high: this.formatNumber(high),
                low: this.formatNumber(low),
                close: this.formatNumber(close),
                volume: volume,
                dayOfWeek: dateObj.toLocaleDateString('ja-JP', { weekday: 'short' })
            });

            latestClose = close;
            if (i === recentLines.length - 2) {
                previousClose = close;
            }
        }

        if (history.length === 0) {
            throw new Error('No valid data found in CSV');
        }

        // 前日終値がない場合は最後から2番目を使用
        if (!previousClose && history.length > 1) {
            previousClose = history[history.length - 2].close;
        } else if (!previousClose) {
            previousClose = latestClose;
        }

        const metadata = this.getSymbolMetadata(symbol);

        return {
            symbol: metadata.symbol,
            name: metadata.name,
            currency: metadata.currency,
            unit: metadata.unit,
            exchangeName: metadata.exchangeName,
            instrumentType: metadata.instrumentType,
            regularMarketPrice: this.formatNumber(latestClose),
            previousClose: this.formatNumber(previousClose),
            lastUpdated: new Date().toISOString(),
            history: history,
            statistics: this.calculateStatistics(history)
        };
    }

    /**
     * シンボルメタデータ取得
     */
    getSymbolMetadata(symbol) {
        const metadata = {
            'xauusd': {
                symbol: 'XAUUSD',
                name: 'Gold Spot Price',
                currency: 'USD',
                unit: 'per troy ounce',
                exchangeName: 'Commodity',
                instrumentType: 'SPOT'
            },
            '1540.jp': {
                symbol: '1540.T',
                name: '純金上場信託（現物国内保管型）',
                currency: 'JPY',
                unit: 'per unit',
                exchangeName: 'Tokyo Stock Exchange',
                instrumentType: 'ETF'
            },
            'usdjpy': {
                symbol: 'USDJPY',
                name: 'USD/JPY 為替レート',
                currency: 'JPY',
                unit: 'per USD',
                exchangeName: 'Forex',
                instrumentType: 'CURRENCY'
            },
            'gc.f': {
                symbol: 'GC=F',
                name: 'Gold Futures (COMEX)',
                currency: 'USD',
                unit: 'per troy ounce',
                exchangeName: 'COMEX',
                instrumentType: 'FUTURE'
            }
        };

        return metadata[symbol.toLowerCase()] || {
            symbol: symbol.toUpperCase(),
            name: 'Unknown',
            currency: 'USD',
            unit: '',
            exchangeName: '',
            instrumentType: ''
        };
    }

    /**
     * 統計情報を計算
     */
    calculateStatistics(history) {
        if (!history || history.length === 0) return null;

        const closes = history.map(d => d.close).filter(v => v !== null && !isNaN(v));
        if (closes.length === 0) return null;

        const latest = closes[closes.length - 1];
        const oldest = closes[0];
        const sum = closes.reduce((a, b) => a + b, 0);
        const avg = sum / closes.length;
        const max = Math.max(...closes);
        const min = Math.min(...closes);
        const change = latest - oldest;
        const changePercent = (change / oldest) * 100;

        // 標準偏差
        const squaredDiffs = closes.map(v => Math.pow(v - avg, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / closes.length;
        const stdDev = Math.sqrt(variance);

        // 移動平均
        const ma5 = closes.length >= 5
            ? closes.slice(-5).reduce((a, b) => a + b, 0) / 5
            : avg;
        const ma10 = closes.length >= 10
            ? closes.slice(-10).reduce((a, b) => a + b, 0) / 10
            : avg;

        return {
            count: closes.length,
            latest: this.formatNumber(latest),
            oldest: this.formatNumber(oldest),
            average: this.formatNumber(avg),
            max: this.formatNumber(max),
            min: this.formatNumber(min),
            change: this.formatNumber(change),
            changePercent: this.formatNumber(changePercent),
            standardDeviation: this.formatNumber(stdDev),
            movingAverage5: this.formatNumber(ma5),
            movingAverage10: this.formatNumber(ma10),
            volatility: this.formatNumber((stdDev / avg) * 100)
        };
    }

    formatNumber(num) {
        if (num === null || num === undefined || isNaN(num)) return null;
        return Math.round(num * 100) / 100;
    }

    /**
     * データをJSON/JSファイルに保存
     */
    saveToFile(filename, data) {
        // JSONファイル
        const jsonPath = path.join(this.dataDir, filename);
        fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');

        // JavaScriptファイル（CORS回避）
        const jsFilename = filename.replace('.json', '.js');
        const jsPath = path.join(this.dataDir, jsFilename);
        const varName = filename.replace('.json', 'Data').replace(/[^a-zA-Z0-9]/g, '');
        const jsContent = `// Auto-generated by convert_data.js\nwindow.${varName} = ${JSON.stringify(data, null, 2)};\n`;
        fs.writeFileSync(jsPath, jsContent, 'utf8');

        console.log(`  Saved: ${filename} + ${jsFilename}`);
    }

    /**
     * 全データを変換
     */
    async convertAllData() {
        console.log('=================================');
        console.log('Data Converter');
        console.log('Cache → JSON/JS');
        console.log('=================================\n');

        const results = {
            success: [],
            failed: []
        };

        for (const [name, symbol] of Object.entries(this.symbols)) {
            console.log(`Converting ${symbol}...`);

            try {
                const cacheFile = this.getLatestCacheFile(symbol);

                if (!cacheFile) {
                    throw new Error('No cache file found');
                }

                const csvData = fs.readFileSync(cacheFile, 'utf8');
                const parsedData = this.parseCSV(csvData, symbol, 30);

                const outputFile = `${name === 'spot' ? 'spot' : name === 'etf' ? 'etf1540' : name === 'forex' ? 'forex' : 'futures'}.json`;
                this.saveToFile(outputFile, parsedData);

                results.success.push(name);
                console.log(`  ✓ Converted (${parsedData.history.length} days)`);

            } catch (error) {
                console.error(`  ✗ Error: ${error.message}`);
                results.failed.push(`${name}: ${error.message}`);
            }
        }

        // サマリーファイル作成
        const summary = {
            lastUpdate: new Date().toISOString(),
            dataSource: 'Stooq.pl',
            dataRange: '30 days',
            symbols: this.symbols,
            status: {
                success: results.success,
                failed: results.failed
            }
        };
        this.saveToFile('summary.json', summary);

        // 結果表示
        console.log('\n=================================');
        console.log('Convert Complete!');
        console.log('=================================');
        console.log(`✓ Success: ${results.success.length}`);
        results.success.forEach(s => console.log(`  - ${s}`));

        if (results.failed.length > 0) {
            console.log(`✗ Failed: ${results.failed.length}`);
            results.failed.forEach(f => console.log(`  - ${f}`));
        }

        console.log(`\nData files saved in: ${this.dataDir}`);
        console.log('=================================\n');

        return results;
    }
}

// メイン処理
if (require.main === module) {
    const converter = new DataConverter();

    converter.convertAllData()
        .then(results => {
            process.exit(results.failed.length > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = DataConverter;
