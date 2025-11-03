// グローバル変数
let autoRefreshInterval = null;

// データ管理
const dataManager = {
    etfData: null,
    forexData: null,
    goldData: null,
    lastUpdate: null
};

// ステータスライン表示関数
function setStatus(message, isError = false) {
    const statusLine = document.getElementById('statusLine');
    if (statusLine) {
        statusLine.textContent = message;
        if (isError) {
            statusLine.classList.add('error');
        } else {
            statusLine.classList.remove('error');
        }
    }
}

// グローバルエラーハンドラー
window.addEventListener('error', (event) => {
    console.error('グローバルエラー:', event.error);
    setStatus(`エラー: ${event.error?.message || event.message}`, true);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('未処理のPromise拒否:', event.reason);
    setStatus(`エラー: ${event.reason?.message || event.reason}`, true);
});

// 設定は不要（オフラインモードのみ使用）

// オフラインデータ管理
class OfflineDataManager {
    constructor() {
        this.spotData = null;
        this.etfData = null;
        this.forexData = null;
        this.futuresData = null;
        this.loaded = false;
        this.chart = null;
        this.chartPeriod = 30; // デフォルトは30日
    }

    async loadOfflineData() {
        try {
            // JavaScriptファイルから直接データを読み込む（CORSエラー回避）
            // window.spotData, window.etf1540Data がdata/*.js で定義される

            // データが読み込まれるまで少し待つ
            await new Promise(resolve => setTimeout(resolve, 100));

            if (window.spotData) {
                this.spotData = window.spotData;
            } else {
                throw new Error('Spot data not found');
            }

            if (window.etf1540Data) {
                this.etfData = window.etf1540Data;
            } else {
                throw new Error('ETF data not found');
            }

            if (window.forexData) {
                this.forexData = window.forexData;
            } else {
                throw new Error('Forex data not found');
            }

            // 先物データは任意
            if (window.futuresData && window.futuresData.history && window.futuresData.history.length > 0) {
                this.futuresData = window.futuresData;
            } else {
                this.futuresData = null;
            }

            this.loaded = true;
            return true;
        } catch (error) {
            console.error('Failed to load offline data:', error);
            return false;
        }
    }


    displayTable() {
        if (!this.loaded) return;

        const tableBody = document.getElementById('tableBody');
        tableBody.innerHTML = ''; // クリア

        // 先物データの有無でテーブルカラムを制御
        const hasFuturesData = this.futuresData && this.futuresData.history && this.futuresData.history.length > 0;
        const futuresHeaders = document.querySelectorAll('th:nth-child(5)');
        futuresHeaders.forEach(th => th.style.display = hasFuturesData ? '' : 'none');

        // 日付でデータをマージ
        const dates = new Map();

        // 各データソースの履歴を日付でマッピング
        if (this.spotData && this.spotData.history) {
            this.spotData.history.forEach(item => {
                if (!dates.has(item.date)) {
                    dates.set(item.date, {});
                }
                dates.get(item.date).spot = item.close;
            });
        }

        if (this.etfData && this.etfData.history) {
            this.etfData.history.forEach(item => {
                if (!dates.has(item.date)) {
                    dates.set(item.date, {});
                }
                dates.get(item.date).etf = item.close;
            });
        }

        if (this.forexData && this.forexData.history) {
            this.forexData.history.forEach(item => {
                if (!dates.has(item.date)) {
                    dates.set(item.date, {});
                }
                dates.get(item.date).forex = item.close;
            });
        }

        if (this.futuresData && this.futuresData.history) {
            this.futuresData.history.forEach(item => {
                if (!dates.has(item.date)) {
                    dates.set(item.date, {});
                }
                dates.get(item.date).futures = item.close;
            });
        }

        // 日付順にソート（新しい順）
        const sortedDates = Array.from(dates.entries()).sort((a, b) =>
            b[0].localeCompare(a[0])
        );

        // テーブル行を生成（ETF 1540のデータがない日は表示しない）
        sortedDates.forEach(([date, values]) => {
            // ETF 1540のデータがない場合はスキップ
            if (!values.etf) {
                return;
            }

            const row = document.createElement('tr');
            // 日付文字列をそのまま使用（タイムゾーン変換を避ける）
            const [year, month, day] = date.split('-');
            const formattedDate = `${parseInt(month)}/${parseInt(day)}`;

            const futuresCell = hasFuturesData
                ? `<td class="number">${values.futures ? `$${values.futures.toFixed(2)}` : '--'}</td>`
                : '<td class="number" style="display: none;">--</td>';

            row.innerHTML = `
                <td>${formattedDate}</td>
                <td class="number">${values.spot ? `$${values.spot.toFixed(2)}` : '--'}</td>
                <td class="number">${values.etf ? `¥${values.etf.toFixed(0)}` : '--'}</td>
                <td class="number">${values.forex ? `¥${values.forex.toFixed(2)}` : '--'}</td>
                ${futuresCell}
            `;
            tableBody.appendChild(row);
        });

        // ステータスライン更新（エラーがない場合のみ）
        const statusLine = document.getElementById('statusLine');
        if (this.spotData && this.spotData.lastUpdated && statusLine && !statusLine.classList.contains('error')) {
            const updateTime = new Date(this.spotData.lastUpdated);
            setStatus(`データ生成日時: ${updateTime.toLocaleString('ja-JP')} | ${sortedDates.length}営業日分のデータ`);
        }
    }

    displayChart(period = this.chartPeriod) {
        if (!this.loaded) return;

        this.chartPeriod = period;

        // チャート用データを準備
        const timestamps = [];
        const spotPrices = [];
        const etfPrices = [];
        const forexRates = [];

        // データをタイムスタンプでマージ
        const dates = new Map();

        if (this.spotData && this.spotData.history) {
            this.spotData.history.forEach(item => {
                if (!dates.has(item.timestamp)) {
                    dates.set(item.timestamp, {});
                }
                dates.get(item.timestamp).spot = item.close;
            });
        }

        if (this.etfData && this.etfData.history) {
            this.etfData.history.forEach(item => {
                if (!dates.has(item.timestamp)) {
                    dates.set(item.timestamp, {});
                }
                dates.get(item.timestamp).etf = item.close;
            });
        }

        if (this.forexData && this.forexData.history) {
            this.forexData.history.forEach(item => {
                if (!dates.has(item.timestamp)) {
                    dates.set(item.timestamp, {});
                }
                dates.get(item.timestamp).forex = item.close;
            });
        }

        // タイムスタンプ順にソート
        const sortedData = Array.from(dates.entries()).sort((a, b) => a[0] - b[0]);

        // ETFデータがある日のみを抽出（グラフ表示用は全データを使用）
        // const validData = sortedData.filter(([ts, values]) => values.etf);
        // 注: グラフには全てのデータを表示（ETFがない日も含む）
        const validData = sortedData;

        // 期間でフィルタリング（最新N日分）
        const filteredData = validData.slice(-period);

        // uPlot用のデータ配列を作成
        filteredData.forEach(([ts, values]) => {
            timestamps.push(ts);
            spotPrices.push(values.spot || null);
            etfPrices.push(values.etf || null);
            forexRates.push(values.forex || null);
        });

        // uPlotのデータ形式
        const data = [
            timestamps,
            spotPrices,
            etfPrices,
            forexRates
        ];

        // チャートコンテナの幅を取得
        const chartElement = document.getElementById('chart');
        const containerWidth = chartElement ? chartElement.parentElement.offsetWidth - 40 : 800;

        // 期間に応じたタイトル
        const periodLabel = period === 5 ? '直近5日' :
                           period === 7 ? '直近1週間' :
                           period === 30 ? '過去30日' :
                           period === 90 ? '過去3ヶ月' :
                           period === 180 ? '過去半年' :
                           period === 365 ? '過去1年' : `過去${period}日`;

        // uPlotオプション
        const opts = {
            title: `ゴールド相場推移（${periodLabel}）`,
            width: containerWidth,
            height: 500,
            series: [
                {
                    label: "日付",
                    value: (self, rawValue) => {
                        if (rawValue == null) return '--';
                        const date = new Date(rawValue * 1000);
                        return `${date.getMonth() + 1}/${date.getDate()}`;
                    }
                },
                {
                    label: "スポット",
                    stroke: "#d4af37",
                    width: 2,
                    scale: "y",
                },
                {
                    label: "1540",
                    stroke: "#4169e1",
                    width: 2,
                    scale: "etf",
                },
                {
                    label: "為替",
                    stroke: "rgba(80, 80, 80, 0.5)",
                    width: 1,
                    scale: "forex",
                }
            ],
            scales: {
                x: {
                    time: true,
                },
                y: {
                    auto: true,
                },
                etf: {
                    auto: true,
                    side: 1,
                },
                forex: {
                    auto: true,
                    side: 1,
                }
            },
            axes: [
                {
                    space: 40,
                    incrs: [
                        // 1日単位
                        3600 * 24,
                        // 1週間単位
                        3600 * 24 * 7,
                        // 1ヶ月単位
                        3600 * 24 * 28,
                    ],
                    values: [
                        [3600 * 24, "{M}/{D}", null, null, null, null, null, null, 1],
                    ],
                },
                {
                    label: "スポット (USD)",
                    stroke: "#d4af37",
                    grid: { stroke: "#f5f5f5" },
                    scale: "y",
                },
                {
                    label: "ETF 1540 (円)",
                    stroke: "#4169e1",
                    side: 1,
                    scale: "etf",
                    grid: { show: false },
                }
            ]
        };

        // チャートを描画
        if (!chartElement) {
            setStatus('チャート要素が見つかりません', true);
            return;
        }

        try {
            // チャート要素をクリア
            chartElement.innerHTML = '';

            // 既存のチャートがあれば破棄
            if (this.chart) {
                this.chart.destroy();
                this.chart = null;
            }

            // 新しいチャートを作成
            this.chart = new uPlot(opts, data, chartElement);
        } catch (error) {
            console.error('チャート描画エラー:', error);
            const errorMsg = `チャート描画エラー: ${error.message || error}`;
            setStatus(errorMsg, true);
        }
    }
}

// グローバルインスタンス
const offlineManager = new OfflineDataManager();

// ブラウザ側Yahoo Financeデータ補完クラス
class BrowserDataPatcher {
    constructor() {
        this.corsProxy = 'https://corsproxy.io/?';
        this.lastFetchTime = null;
        this.fetchInterval = 3600000; // 1時間に1回
        this.shortFetchInterval = 60000; // 1分間の再実行制限
        this.requestDelay = 1000; // リクエスト間の1秒遅延
        this.cooldownTimer = null;
    }

    // LocalStorageから補完データを取得
    loadPatchedData() {
        try {
            const data = localStorage.getItem('yahooFinancePatch');
            if (data) {
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Failed to load patched data:', error);
        }
        return null;
    }

    // 補完データを保存
    savePatchedData(data) {
        try {
            // timestampフィールドを確実に追加
            if (!data.timestamp) {
                data.timestamp = data.fetchedAt || new Date().toISOString();
            }
            localStorage.setItem('yahooFinancePatch', JSON.stringify(data));
            localStorage.setItem('yahooFinancePatchTime', new Date().toISOString());
        } catch (error) {
            console.error('Failed to save patched data:', error);
        }
    }

    // レート制限チェック
    canFetch() {
        const lastTime = localStorage.getItem('yahooFinancePatchTime');
        if (!lastTime) return true;

        const elapsed = Date.now() - new Date(lastTime).getTime();
        return elapsed > this.fetchInterval;
    }

    // 短期レート制限チェック（1分）
    canFetchShort() {
        const lastShortTime = localStorage.getItem('yahooFinanceShortTime');
        if (!lastShortTime) return true;

        const elapsed = Date.now() - new Date(lastShortTime).getTime();
        return elapsed > this.shortFetchInterval;
    }

    // 残り待機時間を取得（秒単位）
    getRemainingCooldown() {
        const lastShortTime = localStorage.getItem('yahooFinanceShortTime');
        if (!lastShortTime) return 0;

        const elapsed = Date.now() - new Date(lastShortTime).getTime();
        const remaining = this.shortFetchInterval - elapsed;
        return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
    }

    // Yahoo Financeからデータ取得（ブラウザ経由）
    async fetchFromYahoo(symbol, startDate) {
        const start = new Date(startDate + 'T00:00:00+09:00');
        start.setDate(start.getDate() + 1);
        const startTimestamp = Math.floor(start.getTime() / 1000);

        const end = new Date();
        const endTimestamp = Math.floor(end.getTime() / 1000);

        const url = `${this.corsProxy}https://query1.finance.yahoo.com/v8/finance/chart/${symbol}` +
                   `?period1=${startTimestamp}&period2=${endTimestamp}` +
                   `&interval=1d&includePrePost=false`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const json = await response.json();
            if (json.chart && json.chart.result && json.chart.result[0]) {
                const result = json.chart.result[0];
                const quotes = result.indicators.quote[0];
                const timestamps = result.timestamp;

                if (!timestamps || timestamps.length === 0) {
                    return null;
                }

                const history = [];
                for (let i = 0; i < timestamps.length; i++) {
                    const date = new Date(timestamps[i] * 1000);
                    const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
                    const dateStr = jstDate.toISOString().split('T')[0];

                    // JST基準のタイムスタンプを計算（日付の00:00:00 JSTに合わせる）
                    const jstDateObj = new Date(dateStr + 'T00:00:00+09:00');
                    const jstTimestamp = Math.floor(jstDateObj.getTime() / 1000);

                    if (quotes.close[i] && quotes.close[i] > 0) {
                        history.push({
                            date: dateStr,
                            timestamp: jstTimestamp,  // JST基準のタイムスタンプを使用
                            open: quotes.open[i] ? Math.round(quotes.open[i] * 100) / 100 : Math.round(quotes.close[i] * 100) / 100,
                            high: quotes.high[i] ? Math.round(quotes.high[i] * 100) / 100 : Math.round(quotes.close[i] * 100) / 100,
                            low: quotes.low[i] ? Math.round(quotes.low[i] * 100) / 100 : Math.round(quotes.close[i] * 100) / 100,
                            close: Math.round(quotes.close[i] * 100) / 100,
                            volume: quotes.volume ? quotes.volume[i] || 0 : 0,
                            dayOfWeek: jstDateObj.toLocaleDateString('ja-JP', { weekday: 'short' }),
                            source: 'Yahoo Finance (Browser)'
                        });
                    }
                }
                return history;
            }
        } catch (error) {
            console.error('Yahoo Finance fetch failed:', error);
        }
        return null;
    }

    // 全データの補完を実行
    async patchAllData() {
        // 1分間の制限を記録
        localStorage.setItem('yahooFinanceShortTime', new Date().toISOString());

        const results = {
            etf: false,
            spot: false,
            forex: false
        };

        // ETF 1540を補完
        results.etf = await this.patchSingleSymbol(
            window.etf1540Data,
            '1540.T',
            'ETF 1540',
            'etf1540'
        );

        // 1秒待機
        await new Promise(resolve => setTimeout(resolve, this.requestDelay));

        // ゴールドスポット価格を補完
        results.spot = await this.patchSingleSymbol(
            window.spotData,
            'GC=F',  // Gold Futures (proxy for spot)
            'Gold Spot',
            'spot'
        );

        // 1秒待機
        await new Promise(resolve => setTimeout(resolve, this.requestDelay));

        // USD/JPY為替レートを補完
        results.forex = await this.patchSingleSymbol(
            window.forexData,
            'USDJPY=X',
            'USD/JPY',
            'forex'
        );

        return results;
    }

    // 全データの補完を実行（クールダウンなし）
    async patchAllDataWithoutCooldown() {
        const results = {
            etf: false,
            spot: false,
            forex: false
        };

        // ETF 1540を補完
        results.etf = await this.patchSingleSymbol(
            window.etf1540Data,
            '1540.T',
            'ETF 1540',
            'etf1540'
        );

        // 1秒待機
        await new Promise(resolve => setTimeout(resolve, this.requestDelay));

        // ゴールドスポット価格を補完
        results.spot = await this.patchSingleSymbol(
            window.spotData,
            'GC=F',  // Gold Futures (proxy for spot)
            'Gold Spot',
            'spot'
        );

        // 1秒待機
        await new Promise(resolve => setTimeout(resolve, this.requestDelay));

        // USD/JPY為替レートを補完
        results.forex = await this.patchSingleSymbol(
            window.forexData,
            'USDJPY=X',
            'USD/JPY',
            'forex'
        );

        return results;
    }

    // 単一シンボルのデータ補完
    async patchSingleSymbol(dataObj, yahooSymbol, displayName, storageKey) {
        if (!dataObj || !dataObj.history) {
            return false;
        }

        const latestDate = dataObj.history[dataObj.history.length - 1].date;

        // Yahoo Financeから補完データ取得
        const patchData = await this.fetchFromYahoo(yahooSymbol, latestDate);

        if (patchData && patchData.length > 0) {

            // 既存データとマージ
            const existingDates = new Set(dataObj.history.map(h => h.date));
            const newRecords = patchData.filter(p => !existingDates.has(p.date));

            if (newRecords.length > 0) {
                // メモリ上のデータを更新
                dataObj.history.push(...newRecords);
                dataObj.history.sort((a, b) => a.date.localeCompare(b.date));

                // LocalStorageに保存（既存データと合併）
                const currentPatchData = this.loadPatchedData() || {};
                currentPatchData[storageKey] = newRecords;
                currentPatchData.fetchedAt = new Date().toISOString();
                this.savePatchedData(currentPatchData);

                setStatus(`${displayName}: ${newRecords.length}件の新データを取得`, false);
                return true;
            }
        }

        return false;
    }

    // ETF 1540の最新データを補完（互換性のため残す）
    async patchETF1540() {
        if (!this.canFetch()) {
            return false;
        }

        return await this.patchSingleSymbol(
            window.etf1540Data,
            '1540.T',
            'ETF 1540',
            'etf1540'
        );
    }

    // 起動時に保存済みデータをロード
    loadAndMerge() {
        const patchedData = this.loadPatchedData();
        if (!patchedData) return;

        // ETF 1540データをマージ
        if (patchedData.etf1540 && window.etf1540Data && window.etf1540Data.history) {
            const existingDates = new Set(window.etf1540Data.history.map(h => h.date));
            const newRecords = patchedData.etf1540.filter(p => !existingDates.has(p.date));

            if (newRecords.length > 0) {
                window.etf1540Data.history.push(...newRecords);
                window.etf1540Data.history.sort((a, b) => a.date.localeCompare(b.date));
            }
        }

        // ゴールドスポット価格データをマージ
        if (patchedData.spot && window.spotData && window.spotData.history) {
            const existingDates = new Set(window.spotData.history.map(h => h.date));
            const newRecords = patchedData.spot.filter(p => !existingDates.has(p.date));

            if (newRecords.length > 0) {
                window.spotData.history.push(...newRecords);
                window.spotData.history.sort((a, b) => a.date.localeCompare(b.date));
            }
        }

        // 為替レートデータをマージ
        if (patchedData.forex && window.forexData && window.forexData.history) {
            const existingDates = new Set(window.forexData.history.map(h => h.date));
            const newRecords = patchedData.forex.filter(p => !existingDates.has(p.date));

            if (newRecords.length > 0) {
                window.forexData.history.push(...newRecords);
                window.forexData.history.sort((a, b) => a.date.localeCompare(b.date));
            }
        }
    }
}

// グローバルインスタンス
const browserPatcher = new BrowserDataPatcher();

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

// グローバルスコープに配置してloadAndDisplayDataからもアクセス可能にする
let updateButtonCooldown = null;

// データ鮮度情報を更新する関数
function updateDataFreshness() {
    const lastUpdateElement = document.getElementById('lastUpdate');
    if (!lastUpdateElement) return;

    // 静的データの最新日付を取得
    let staticDataDate = null;
    if (window.spotData && window.spotData.history && window.spotData.history.length > 0) {
        const lastSpotDate = window.spotData.history[window.spotData.history.length - 1].date;
        staticDataDate = lastSpotDate;
    }

    // Yahoo Financeから取得したデータの有無をチェック
    const patchedData = browserPatcher.loadPatchedData();

    let patchedDataTime = null;
    // timestampまたはfetchedAtフィールドをチェック
    if (patchedData) {
        const timeField = patchedData.timestamp || patchedData.fetchedAt;
        if (timeField) {
            patchedDataTime = new Date(timeField);
        }
    }

    // 表示内容を構築
    lastUpdateElement.innerHTML = ''; // クリア

    if (staticDataDate) {
        // 静的データ部分（ファイルアイコン付き）
        const [year, month, day] = staticDataDate.split('-');
        const staticSpan = document.createElement('span');
        staticSpan.textContent = `📁 ${month}/${day}`;  // ファイルアイコン
        lastUpdateElement.appendChild(staticSpan);
    }

    if (patchedDataTime) {
        if (staticDataDate) {
            // スペースで区切る
            const separator = document.createElement('span');
            separator.textContent = '  ';  // スペース2つ
            lastUpdateElement.appendChild(separator);
        }

        // クリック可能な追加データ部分（更新アイコン付き）
        const patchedSpan = document.createElement('span');
        patchedSpan.textContent = `🔄 ${patchedDataTime.toLocaleString('ja-JP', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })}`;  // 更新アイコン

        // シンプルなホバースタイル（アニメーションなし）
        patchedSpan.style.cursor = 'pointer';
        patchedSpan.style.opacity = '0.8';
        patchedSpan.style.padding = '0 4px';  // 最初から固定パディング
        patchedSpan.style.borderRadius = '3px';
        patchedSpan.style.marginLeft = '-4px';  // 最初から固定マージン
        patchedSpan.title = 'クリックしてLocalStorageのYahoo Financeデータを削除';

        // ホバー時の効果（位置変更なし、背景色のみ）
        patchedSpan.addEventListener('mouseenter', () => {
            patchedSpan.style.opacity = '1';
            patchedSpan.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        });

        patchedSpan.addEventListener('mouseleave', () => {
            patchedSpan.style.opacity = '0.8';
            patchedSpan.style.backgroundColor = 'transparent';
        });

        // クリックイベントでLocalStorageをクリア
        patchedSpan.addEventListener('click', () => {
            if (confirm('LocalStorageに保存されているYahoo Financeのデータを削除しますか？\n\n※ 静的データは削除されません')) {
                // LocalStorageから削除
                localStorage.removeItem('yahooFinancePatch');
                localStorage.removeItem('yahooFinancePatchTime');
                localStorage.removeItem('yahooFinanceShortTime');

                // メモリ上のパッチデータをリセット（再読み込み）
                location.reload();

                // メッセージ表示
                setStatus('LocalStorageのデータを削除しました。ページを再読み込みします...', false);
            }
        });

        lastUpdateElement.appendChild(patchedSpan);
    }

    if (!lastUpdateElement.textContent) {
        lastUpdateElement.textContent = '--:--';
    }
}

function initializeApp() {
    // イベントリスナーの設定

    // チャート期間選択ボタン
    const periodButtons = document.querySelectorAll('.period-btn:not(#patchDataBtn)');
    periodButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const period = parseInt(e.target.dataset.period);

            // アクティブボタンの切り替え
            periodButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // チャートを再描画
            offlineManager.displayChart(period);
        });
    });

    // 最新データ取得ボタン
    const patchDataBtn = document.getElementById('patchDataBtn');
    if (patchDataBtn) {
        // クールダウンタイマーの管理
        updateButtonCooldown = () => {
            const remaining = browserPatcher.getRemainingCooldown();
            if (remaining > 0) {
                patchDataBtn.disabled = true;
                patchDataBtn.textContent = `待機中 (${remaining}秒)`;

                // プログレスバー風の背景を更新（より暗いグレーベース、薄い白のプログレス）
                const progress = ((60 - remaining) / 60) * 100;
                patchDataBtn.style.background = `linear-gradient(to right, #e5e7eb ${progress}%, #374151 ${progress}%)`;

                // 1秒後に再度チェック
                setTimeout(updateButtonCooldown, 1000);
            } else {
                patchDataBtn.disabled = false;
                patchDataBtn.textContent = '最新データ取得';
                patchDataBtn.style.background = '#667eea';
            }
        };

        // 初期状態をチェック
        updateButtonCooldown();

        patchDataBtn.addEventListener('click', async () => {
            // 短期制限チェック
            if (!browserPatcher.canFetchShort()) {
                const remaining = browserPatcher.getRemainingCooldown();
                setStatus(`再実行まで ${remaining} 秒お待ちください`, true);
                return;
            }

            patchDataBtn.disabled = true;
            patchDataBtn.textContent = '取得中...';
            setStatus('Yahoo Financeから最新データを取得中...');

            // 強制的にレート制限をリセット（手動実行時）
            localStorage.removeItem('yahooFinancePatchTime');

            const results = await browserPatcher.patchAllData();

            // 結果をカウント
            const patchedCount = [results.etf, results.spot, results.forex].filter(x => x).length;

            if (patchedCount > 0) {
                // データを再表示
                offlineManager.displayChart();
                offlineManager.displayTable();

                const items = [];
                if (results.etf) items.push('ETF 1540');
                if (results.spot) items.push('Gold Spot');
                if (results.forex) items.push('USD/JPY');
                setStatus(`${items.join(', ')} の最新データを取得しました`, false);

                // データ鮮度情報を更新
                updateDataFreshness();
            } else {
                setStatus('最新データはありませんでした', false);
            }

            // クールダウンタイマーを開始
            updateButtonCooldown();
        });
    }

    // データを読み込んで表示を開始
    loadAndDisplayData();
}

// データ読み込みと表示
async function loadAndDisplayData() {
    setStatus("データを読み込み中...");
    const success = await offlineManager.loadOfflineData();

    if (success) {
        // LocalStorageから補完データをロード
        browserPatcher.loadAndMerge();

        // データ表示
        offlineManager.displayChart();
        offlineManager.displayTable();

        // データ鮮度情報を初期表示
        updateDataFreshness();

        // ブラウザ側でYahoo Financeから補完を試行
        setTimeout(async () => {
            if (!browserPatcher.canFetch()) {
                return;
            }

            // 手動実行と同じ処理を実行
            const patchDataBtn = document.getElementById('patchDataBtn');

            // ボタンを「取得中...」に変更
            if (patchDataBtn) {
                patchDataBtn.disabled = true;
                patchDataBtn.textContent = '取得中...';
            }

            // ステータスメッセージを表示
            setStatus('Yahoo Financeから最新データを自動取得中...');

            // クールダウン付きでデータ取得（手動実行と同じ関数を使用）
            const results = await browserPatcher.patchAllData();

            // 結果をカウント
            const patchedCount = [results.etf, results.spot, results.forex].filter(x => x).length;

            if (patchedCount > 0) {
                // データを再表示
                offlineManager.displayChart();
                offlineManager.displayTable();

                const items = [];
                if (results.etf) items.push('ETF 1540');
                if (results.spot) items.push('Gold Spot');
                if (results.forex) items.push('USD/JPY');
                setStatus(`${items.join(', ')} の最新データを自動取得しました`, false);

                // データ鮮度情報を更新
                updateDataFreshness();
            } else {
                setStatus('最新データはありませんでした（自動取得）', false);
            }

            // クールダウンタイマーを開始（手動実行と同じ）
            if (patchDataBtn && typeof updateButtonCooldown === 'function') {
                updateButtonCooldown();
            }
        }, 2000); // 2秒後に実行
    } else {
        setStatus("データの読み込みに失敗しました。\"make update\" を実行してデータを取得してください。", true);
    }
}
