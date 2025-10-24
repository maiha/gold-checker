#!/usr/bin/env node

/**
 * CSVデータ取得スクリプト
 * Stooq.plから過去30日分のCSVデータを取得してキャッシュ
 * 同日のデータが既にある場合はスキップ（冪等性）
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

class DataFetcher {
    constructor() {
        this.symbols = {
            spot: 'xauusd',
            etf: '1540.jp',
            forex: 'usdjpy',
            // futures: 'gc.f'  // 一時的にコメントアウト
        };

        this.cacheDir = path.join(__dirname, 'cache');

        // キャッシュディレクトリ作成
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
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
     * キャッシュが存在するかチェック
     */
    hasCachedData(symbol) {
        const cachePath = this.getCacheFilePath(symbol);
        return fs.existsSync(cachePath);
    }

    /**
     * StooqからCSVデータを取得
     */
    async fetchCSV(symbol) {
        const url = `https://stooq.pl/q/d/l/?s=${symbol}&i=d`;

        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    resolve(data);
                });

            }).on('error', (err) => {
                reject(err);
            });
        });
    }

    /**
     * CSVデータをキャッシュに保存
     */
    saveToCacheFile(symbol, csvData) {
        const cachePath = this.getCacheFilePath(symbol);
        fs.writeFileSync(cachePath, csvData, 'utf8');
        console.log(`  Cached: ${path.basename(cachePath)}`);
    }

    /**
     * 古いキャッシュファイルを削除（7日以上前のもの）
     */
    cleanOldCache() {
        const files = fs.readdirSync(this.cacheDir);
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

        files.forEach(file => {
            const filePath = path.join(this.cacheDir, file);
            const stats = fs.statSync(filePath);

            if (stats.mtimeMs < sevenDaysAgo) {
                fs.unlinkSync(filePath);
                console.log(`  Deleted old cache: ${file}`);
            }
        });
    }

    /**
     * 全データを取得
     */
    async fetchAllData() {
        console.log('=================================');
        console.log('Data Fetcher');
        console.log('Source: Stooq.pl');
        console.log('=================================');
        console.log(`Date: ${this.getTodayDate()}\n`);

        const results = {
            fetched: [],
            cached: [],
            failed: []
        };

        for (const [name, symbol] of Object.entries(this.symbols)) {
            console.log(`Processing ${symbol}...`);

            // キャッシュチェック
            if (this.hasCachedData(symbol)) {
                console.log(`  ✓ Already cached (skipping fetch)`);
                results.cached.push(name);
                continue;
            }

            // データ取得
            try {
                const csvData = await this.fetchCSV(symbol);

                // 空チェック
                if (!csvData || csvData.trim().length === 0) {
                    throw new Error('Empty response');
                }

                this.saveToCacheFile(symbol, csvData);
                results.fetched.push(name);
                console.log(`  ✓ Fetched and cached`);

            } catch (error) {
                console.error(`  ✗ Error: ${error.message}`);
                results.failed.push(`${name}: ${error.message}`);
            }
        }

        // 古いキャッシュクリーンアップ
        console.log('\nCleaning old cache files...');
        this.cleanOldCache();

        // 結果表示
        console.log('\n=================================');
        console.log('Fetch Complete!');
        console.log('=================================');

        if (results.fetched.length > 0) {
            console.log(`✓ Fetched: ${results.fetched.length}`);
            results.fetched.forEach(s => console.log(`  - ${s}`));
        }

        if (results.cached.length > 0) {
            console.log(`○ Cached: ${results.cached.length}`);
            results.cached.forEach(s => console.log(`  - ${s}`));
        }

        if (results.failed.length > 0) {
            console.log(`✗ Failed: ${results.failed.length}`);
            results.failed.forEach(f => console.log(`  - ${f}`));
        }

        console.log(`\nCache directory: ${this.cacheDir}`);
        console.log('=================================\n');

        return results;
    }
}

// メイン処理
if (require.main === module) {
    const fetcher = new DataFetcher();

    fetcher.fetchAllData()
        .then(results => {
            // 失敗があっても、キャッシュされたデータがあれば成功とする
            const hasData = (results.fetched.length + results.cached.length) >= 2;
            process.exit(hasData ? 0 : 1);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = DataFetcher;
