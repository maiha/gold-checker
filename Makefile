# Gold Checker Makefile
# データ更新とメンテナンス用コマンド

.PHONY: update fetch convert check clean clean-cache help install

# デフォルトターゲット
default: help

# データ更新（fetch → convert）
update: fetch convert
	@echo ""
	@echo "✅ Data update completed!"
	@echo ""

# CSVデータ取得（冪等・キャッシュ利用）
fetch:
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "📡 Fetching CSV data from Stooq.pl..."
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@node fetch_data.js
	@echo ""

# JSON/JS変換（キャッシュから生成）
convert:
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "🔄 Converting cached data to JSON/JS..."
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@node convert_data.js
	@echo ""

# データファイル確認
check:
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "📁 Checking data files..."
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@if [ -d "data" ]; then \
		echo "\n📂 Data directory contents:"; \
		ls -lh data/*.json 2>/dev/null || echo "No JSON files found"; \
		echo ""; \
		if [ -f "data/summary.json" ]; then \
			echo "📋 Last update info:"; \
			node -e "const s=require('./data/summary.json'); console.log('  Time:', s.lastUpdate); console.log('  Success:', s.status.success.join(', ') || 'None'); console.log('  Failed:', s.status.failed.join(', ') || 'None');" 2>/dev/null || echo "Unable to read summary"; \
		fi; \
	else \
		echo "❌ Data directory not found. Run 'make update' first."; \
	fi
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# データクリーン（JSON/JSファイルのみ）
clean:
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "🧹 Cleaning data files..."
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@if [ -d "data" ]; then \
		rm -f data/*.json data/*.js; \
		echo "✅ Data files removed (cache preserved)"; \
	else \
		echo "ℹ️  No data directory to clean"; \
	fi
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# キャッシュクリーン
clean-cache:
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "🧹 Cleaning cache files..."
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@if [ -d "cache" ]; then \
		rm -f cache/*.csv; \
		echo "✅ Cache files removed"; \
	else \
		echo "ℹ️  No cache directory to clean"; \
	fi
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Node.js環境確認
install:
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "📦 Checking Node.js environment..."
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@node --version || (echo "❌ Node.js not found. Please install Node.js first." && exit 1)
	@echo "✅ Node.js is installed"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 自動更新（cron用）
auto-update:
	@date "+%Y-%m-%d %H:%M:%S - Starting auto update" >> update.log
	@make update >> update.log 2>&1
	@date "+%Y-%m-%d %H:%M:%S - Update completed" >> update.log
	@echo "" >> update.log

# ヘルプ
help:
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "🏆 Gold Checker - Data Management"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	@echo "Available commands:"
	@echo ""
	@echo "  make update       📊 Full data update (fetch → convert)"
	@echo "  make fetch        📡 Fetch CSV from Stooq.pl (cached, idempotent)"
	@echo "  make convert      🔄 Convert cached CSV to JSON/JS"
	@echo "  make check        📁 Check data files and last update info"
	@echo "  make clean        🧹 Remove data files (preserve cache)"
	@echo "  make clean-cache  🗑️  Remove cache files"
	@echo "  make install      📦 Check Node.js installation"
	@echo "  make help         ❓ Show this help message"
	@echo ""
	@echo "Quick start:"
	@echo "  1. Run 'make update' to fetch & convert latest data"
	@echo "  2. Open index.html in your browser"
	@echo ""
	@echo "Cache behavior:"
	@echo "  - 'make fetch' is idempotent (skips if today's data exists)"
	@echo "  - Cache is stored in cache/ directory"
	@echo "  - Old cache (7+ days) is auto-cleaned"
	@echo "  - 'make convert' can run multiple times without re-fetching"
	@echo ""
	@echo "Data Sources:"
	@echo "  Primary: Stooq.pl (https://stooq.pl)"
	@echo "    - Gold Spot Price (XAUUSD)"
	@echo "    - ETF 1540 (Tokyo Stock Exchange)"
	@echo "    - USD/JPY 為替レート"
	@echo "  Browser: Yahoo Finance (最新データ取得ボタン)"
	@echo "    - ブラウザ経由で最新データを補完"
	@echo "    - LocalStorageに保存"
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"