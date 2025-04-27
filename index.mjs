import { WebSocketServer } from 'ws';
import fluvioClient from '@fluvio/client';

const PORT = 3001;
// Popular Indian stock indices
const INDEX_TOPICS = ['nifty-50', 'bank-nifty', 'fin-nifty', 'sensex', 'nifty-next-50', 'nifty-midcap-100'];

// 100+ popular stocks across various sectors
const STOCK_TOPICS = [
  // Large Cap
  'reliance', 'tcs', 'hdfc-bank', 'infosys', 'icici-bank', 'hul', 'itc', 'sbi', 'bharti-airtel', 'bajaj-finance',
  'kotak-bank', 'axis-bank', 'larsen', 'hdfc-life', 'titan', 'asian-paints', 'maruti-suzuki', 'sun-pharma', 'ongc', 'power-grid',
  'adani-ports', 'ntpc', 'ultratech', 'grasim', 'wipro', 'bajaj-finserv', 'hcl-tech', 'tata-motors', 'adani-enterprises', 'indusind-bank',
  'mahindra', 'coal-india', 'jsw-steel', 'bhel', 'hero-motocorp', 'apollo-hospitals', 'nestle', 'britannia', 'tech-mahindra', 'bajaj-auto',
  // Mid Cap
  'pidilite', 'havells', 'dabur', 'berger-paints', 'siemens', 'icici-lombard', 'sbi-life', 'idfc-first', 'abbott-india', 'aurobindo-pharma',
  'biocon', 'cadila', 'godrej-consumer', 'lupin', 'mrf', 'marico', 'page-industries', 'petronet', 'piramal', 'sbi-cards',
  'torrent-pharma', 'tata-power', 'trent', 'united-breweries', 'vedanta', 'zydus', 'indus-towers', 'cummins', 'ltimindtree', 'bandhan-bank',
  'union-bank', 'canara-bank', 'punjab-national', 'bank-of-baroda', 'federal-bank', 'indian-oil', 'bharat-petro', 'hindustan-petro', 'gail', 'jindal-steel',
  // Small Cap
  'raymond', 'alembic', 'ashok-leyland', 'century-textiles', 'dixon', 'exide', 'fortis', 'godrej-properties', 'irctc', 'jubilant-food',
  'laurus-labs', 'manappuram', 'mindtree', 'muthoot-finance', 'natco', 'oberoi-realty', 'pnb-housing', 'prestige-estates', 'rbl-bank', 'sail',
  'sun-tv', 'tata-chemicals', 'tata-consumer', 'uco-bank', 'vodafone-idea', 'yes-bank', 'zee-entertainment', 'adani-green', 'affle', 'ajanta-pharma',
  'astral', 'balrampur-chini', 'bel', 'cesc', 'coforge', 'deepak-nitrite', 'dhani', 'edelweiss', 'escorts', 'uflex'
];

const ALL_TOPICS = [...INDEX_TOPICS, ...STOCK_TOPICS];

const wss = new WebSocketServer({ port: PORT });
const clients = new Set();

// Base values for indices and stocks (realistic starting points in INR)
const BASE_VALUES = {
  // Indices
  'nifty-50': 22000,
  'bank-nifty': 48000,
  'fin-nifty': 21000,
  'sensex': 72000,
  'nifty-next-50': 52000,
  'nifty-midcap-100': 48000,
  
  // Large Cap Stocks
  'reliance': 2800, 'tcs': 3500, 'hdfc-bank': 1600, 'infosys': 1450, 'icici-bank': 1050,
  'hul': 2500, 'itc': 430, 'sbi': 750, 'bharti-airtel': 1200, 'bajaj-finance': 7000,
  'kotak-bank': 1900, 'axis-bank': 1050, 'larsen': 3400, 'hdfc-life': 650, 'titan': 3200,
  'asian-paints': 3100, 'maruti-suzuki': 11500, 'sun-pharma': 1350, 'ongc': 260, 'power-grid': 290,
  'adani-ports': 1150, 'ntpc': 310, 'ultratech': 9900, 'grasim': 2200, 'wipro': 450,
  'bajaj-finserv': 1600, 'hcl-tech': 1350, 'tata-motors': 950, 'adani-enterprises': 2800, 'indusind-bank': 1450,
  'mahindra': 1900, 'coal-india': 390, 'jsw-steel': 850, 'bhel': 220, 'hero-motocorp': 4100,
  'apollo-hospitals': 5700, 'nestle': 2300, 'britannia': 4900, 'tech-mahindra': 1250, 'bajaj-auto': 7200,
  
  // Mid Cap Stocks
  'pidilite': 2600, 'havells': 1400, 'dabur': 530, 'berger-paints': 580, 'siemens': 4300,
  'icici-lombard': 1350, 'sbi-life': 1400, 'idfc-first': 90, 'abbott-india': 23000, 'aurobindo-pharma': 850,
  'biocon': 260, 'cadila': 650, 'godrej-consumer': 1100, 'lupin': 1400, 'mrf': 112000,
  'marico': 540, 'page-industries': 39000, 'petronet': 220, 'piramal': 950, 'sbi-cards': 770,
  'torrent-pharma': 2100, 'tata-power': 350, 'trent': 3800, 'united-breweries': 1700, 'vedanta': 430,
  'zydus': 670, 'indus-towers': 240, 'cummins': 2100, 'ltimindtree': 5200, 'bandhan-bank': 220,
  'union-bank': 110, 'canara-bank': 430, 'punjab-national': 95, 'bank-of-baroda': 240, 'federal-bank': 155,
  'indian-oil': 125, 'bharat-petro': 390, 'hindustan-petro': 340, 'gail': 170, 'jindal-steel': 820,
  
  // Small Cap Stocks
  'raymond': 1700, 'alembic': 80, 'ashok-leyland': 190, 'century-textiles': 1300, 'dixon': 6600,
  'exide': 350, 'fortis': 350, 'godrej-properties': 2200, 'irctc': 900, 'jubilant-food': 550,
  'laurus-labs': 380, 'manappuram': 160, 'mindtree': 4600, 'muthoot-finance': 1300, 'natco': 810,
  'oberoi-realty': 1200, 'pnb-housing': 750, 'prestige-estates': 1100, 'rbl-bank': 240, 'sail': 120,
  'sun-tv': 640, 'tata-chemicals': 1100, 'tata-consumer': 1050, 'uco-bank': 40, 'vodafone-idea': 13,
  'yes-bank': 22, 'zee-entertainment': 280, 'adani-green': 1500, 'affle': 1100, 'ajanta-pharma': 1900,
  'astral': 1800, 'balrampur-chini': 400, 'bel': 240, 'cesc': 120, 'coforge': 5900,
  'deepak-nitrite': 2200, 'dhani': 60, 'edelweiss': 70, 'escorts': 3200, 'uflex': 450
};

// Define strike ranges for each instrument (relative to base)
const STRIKE_RANGES = {};

// Set default strike ranges based on price range
Object.entries(BASE_VALUES).forEach(([instrument, price]) => {
  if (INDEX_TOPICS.includes(instrument)) {
    // For indices
    if (price > 50000) STRIKE_RANGES[instrument] = { step: 500, count: 10 };
    else if (price > 20000) STRIKE_RANGES[instrument] = { step: 200, count: 10 };
    else STRIKE_RANGES[instrument] = { step: 100, count: 10 };
  } else {
    // For stocks, based on price
    if (price > 10000) STRIKE_RANGES[instrument] = { step: 100, count: 10 };
    else if (price > 5000) STRIKE_RANGES[instrument] = { step: 50, count: 10 };
    else if (price > 2000) STRIKE_RANGES[instrument] = { step: 20, count: 10 };
    else if (price > 1000) STRIKE_RANGES[instrument] = { step: 10, count: 10 };
    else if (price > 500) STRIKE_RANGES[instrument] = { step: 5, count: 10 };
    else if (price > 200) STRIKE_RANGES[instrument] = { step: 2, count: 10 };
    else if (price > 50) STRIKE_RANGES[instrument] = { step: 1, count: 10 };
    else STRIKE_RANGES[instrument] = { step: 0.5, count: 10 };
  }
});

// Define instrument types (index or stock)
const INSTRUMENT_TYPES = {};
INDEX_TOPICS.forEach(topic => INSTRUMENT_TYPES[topic] = 'index');
STOCK_TOPICS.forEach(topic => INSTRUMENT_TYPES[topic] = 'stock');

// Define lot sizes for derivatives (realistic lot sizes for Indian market)
const LOT_SIZES = {
  // Indices
  'nifty-50': 50, 'bank-nifty': 15, 'fin-nifty': 40, 'sensex': 10,
  'nifty-next-50': 75, 'nifty-midcap-100': 75,
  
  // Common stocks lot sizes (sample values, would be based on actual exchange defined lot sizes)
  'reliance': 250, 'tcs': 150, 'hdfc-bank': 300, 'infosys': 300, 'icici-bank': 425,
  'hul': 300, 'itc': 1800, 'sbi': 600, 'bharti-airtel': 425, 'bajaj-finance': 125
};

// Set default lot sizes for stocks without specific definitions
STOCK_TOPICS.forEach(stock => {
  if (!LOT_SIZES[stock]) {
    // Assign lot size inversely proportional to price (higher price = smaller lot)
    const price = BASE_VALUES[stock];
    if (price > 5000) LOT_SIZES[stock] = 50;
    else if (price > 2000) LOT_SIZES[stock] = 100;
    else if (price > 1000) LOT_SIZES[stock] = 150;
    else if (price > 500) LOT_SIZES[stock] = 300;
    else if (price > 200) LOT_SIZES[stock] = 600;
    else if (price > 100) LOT_SIZES[stock] = 1200;
    else LOT_SIZES[stock] = 1800;
  }
});

// Define sector information for stocks
const SECTORS = {
  // Large Cap
  'reliance': 'Oil & Gas', 'tcs': 'IT', 'hdfc-bank': 'Banking', 'infosys': 'IT', 'icici-bank': 'Banking',
  'hul': 'FMCG', 'itc': 'FMCG', 'sbi': 'Banking', 'bharti-airtel': 'Telecom', 'bajaj-finance': 'Financial Services',
  'kotak-bank': 'Banking', 'axis-bank': 'Banking', 'larsen': 'Construction', 'hdfc-life': 'Insurance', 'titan': 'Consumer Durables',
  'asian-paints': 'Paints', 'maruti-suzuki': 'Automobiles', 'sun-pharma': 'Pharmaceuticals', 'ongc': 'Oil & Gas', 'power-grid': 'Power',
  'adani-ports': 'Logistics', 'ntpc': 'Power', 'ultratech': 'Cement', 'grasim': 'Cement', 'wipro': 'IT',
  'bajaj-finserv': 'Financial Services', 'hcl-tech': 'IT', 'tata-motors': 'Automobiles', 'adani-enterprises': 'Conglomerate', 'indusind-bank': 'Banking',
  'mahindra': 'Automobiles', 'coal-india': 'Mining', 'jsw-steel': 'Steel', 'bhel': 'Power Equipment', 'hero-motocorp': 'Automobiles',
  'apollo-hospitals': 'Healthcare', 'nestle': 'FMCG', 'britannia': 'FMCG', 'tech-mahindra': 'IT', 'bajaj-auto': 'Automobiles',
  
  // Mid Cap (sample)
  'pidilite': 'Chemicals', 'havells': 'Electronics', 'dabur': 'FMCG', 'berger-paints': 'Paints', 'siemens': 'Engineering',
  'icici-lombard': 'Insurance', 'sbi-life': 'Insurance'
  // Add more sectors as needed
};

// Set default sectors for stocks without specific definitions
STOCK_TOPICS.forEach(stock => {
  if (!SECTORS[stock]) {
    // Assign a generic sector based on stock name pattern or randomize from common sectors
    const commonSectors = ['Banking', 'IT', 'Pharma', 'FMCG', 'Auto', 'Metals', 'Energy', 'Infrastructure', 'Financial Services', 'Telecom'];
    const randomIndex = Math.floor(Math.random() * commonSectors.length);
    SECTORS[stock] = commonSectors[randomIndex];
  }
});

// Market cap categories
const MARKET_CAP = {};
// Categorize all stocks based on name groups (in a real system this would be based on actual market cap)
STOCK_TOPICS.forEach(stock => {
  if (STOCK_TOPICS.indexOf(stock) < 40) {
    MARKET_CAP[stock] = 'Large Cap';
  } else if (STOCK_TOPICS.indexOf(stock) < 80) {
    MARKET_CAP[stock] = 'Mid Cap';
  } else {
    MARKET_CAP[stock] = 'Small Cap';
  }
});

console.log(`🚀 WebSocket server running on ws://localhost:${PORT}`);
console.log(`📊 Tracking ${INDEX_TOPICS.length} indices and ${STOCK_TOPICS.length} stocks`);

// Debug fluvio client exports
console.log('fluvioClient type:', typeof fluvioClient);
console.log('fluvioClient exports:', fluvioClient ? Object.keys(fluvioClient) : 'null or undefined');

// Broadcast to all connected clients
function broadcast(type, payload) {
    const message = JSON.stringify({ type, payload });
    for (const client of clients) {
        if (client.readyState === 1) { // 1 = OPEN
            client.send(message);
        }
    }
}

// Generate option chain data for a specific instrument
function generateOptionChain(instrumentName, currentValue) {
    const { step, count } = STRIKE_RANGES[instrumentName];
    const baseStrike = Math.round(currentValue / step) * step; // Round to nearest step
    
    // Generate strikes centered around current value
    const strikes = Array.from({ length: count }, (_, i) => 
        baseStrike + step * (i - Math.floor(count/2))
    ).sort((a, b) => a - b);
    
    // Generate calls and puts
    const calls = strikes.map(strike => {
        const diff = currentValue - strike;
        // Calculate realistic option price based on distance from strike
        const price = Math.max(0, diff + (Math.random() * (step * 0.3) + (step * 0.1))).toFixed(2);
        const iv = (Math.random() * 10 + 15).toFixed(2); // 15-25% IV
        const oi = Math.floor(Math.random() * 5000) + 500; // Open Interest
        const volume = Math.floor(Math.random() * 2000) + 100; // Volume
        
        return {
            strike,
            price,
            iv: `${iv}%`,
            change: (Math.random() * 8 - 4).toFixed(2),
            oi,
            volume
        };
    });
    
    const puts = strikes.map(strike => {
        const diff = strike - currentValue;
        // Calculate realistic option price based on distance from strike
        const price = Math.max(0, diff + (Math.random() * (step * 0.3) + (step * 0.1))).toFixed(2);
        const iv = (Math.random() * 10 + 15).toFixed(2); // 15-25% IV
        const oi = Math.floor(Math.random() * 5000) + 500; // Open Interest
        const volume = Math.floor(Math.random() * 2000) + 100; // Volume
        
        return {
            strike,
            price,
            iv: `${iv}%`,
            change: (Math.random() * 8 - 4).toFixed(2),
            oi,
            volume
        };
    });
    
    return { calls, puts };
}

// Generate additional market data for stocks
function generateStockData(stockName, currentValue) {
    const dayHigh = (currentValue * (1 + Math.random() * 0.03)).toFixed(2);
    const dayLow = (currentValue * (1 - Math.random() * 0.03)).toFixed(2);
    const volume = Math.floor(Math.random() * 1000000) + 100000;
    const valueTraded = (volume * currentValue / 100000).toFixed(2) + " Cr";
    const pe = (Math.random() * 20 + 10).toFixed(2);
    const marketCap = (currentValue * (Math.random() * 500 + 500) / 100).toFixed(2) + " Cr";
    const yearHigh = (currentValue * (1 + Math.random() * 0.2)).toFixed(2);
    const yearLow = (currentValue * (1 - Math.random() * 0.2)).toFixed(2);
    
    return {
        dayHigh,
        dayLow,
        volume,
        valueTraded,
        pe,
        marketCap,
        yearHigh,
        yearLow,
        sector: SECTORS[stockName] || 'Other',
        marketCapCategory: MARKET_CAP[stockName] || 'Mid Cap',
        lotSize: LOT_SIZES[stockName] || 100
    };
}

// Generate market breadth data for indices
function generateMarketBreadth(indexName) {
    const advancers = Math.floor(Math.random() * 40) + 10;
    const decliners = Math.floor(Math.random() * 40) + 10;
    const unchanged = Math.floor(Math.random() * 10);
    const totalVolume = (Math.random() * 10000 + 5000).toFixed(2) + " Cr";
    const marketWidth = (Math.random() + 0.5).toFixed(2);
    
    return {
        advancers,
        decliners,
        unchanged,
        total: advancers + decliners + unchanged,
        adv_dec_ratio: (advancers / decliners).toFixed(2),
        totalVolume,
        marketWidth
    };
}

async function runServer() {
    try {
        // Create fluvio instance or mock
        let fluvio = {
            topicProducer: async (topic) => ({
                send: async (t, data) => console.log(`Mock producer: would send to ${t}: ${data.substring(0, 50)}...`)
            }),
            partitionConsumer: async (topic, partition) => ({
                stream: (offset, callback) => {
                    console.log(`Mock consumer: would stream from ${topic}-${partition}`);
                    return { close: () => console.log(`Closed stream for ${topic}-${partition}`) };
                }
            })
        };
        
        console.log('✅ Fluvio mock instance created successfully');
        
        const producers = {};
        const consumers = {};
        
        // Set up producers and consumers for each topic
        for (const topic of ALL_TOPICS) {
            producers[topic] = await fluvio.topicProducer(topic);
            consumers[topic] = await fluvio.partitionConsumer(topic, 0);
        }
        
        // Keep track of current values for each instrument
        const currentValues = Object.fromEntries(
            ALL_TOPICS.map(topic => [topic, BASE_VALUES[topic]])
        );
        
        // WebSocket connection handling
        wss.on('connection', (ws) => {
            console.log('✅ Client connected');
            clients.add(ws);
            
            // Send initial data for all instruments
            ALL_TOPICS.forEach(topic => {
                const value = currentValues[topic];
                const isIndex = INDEX_TOPICS.includes(topic);
                
                const data = {
                    instrument: topic,
                    type: INSTRUMENT_TYPES[topic],
                    value: value.toFixed(2),
                    timestamp: new Date().toISOString(),
                    change: '0.00',
                    percentChange: '0.00%'
                };
                
                // Add option chain data
                data.optionChain = generateOptionChain(topic, value);
                
                // Add additional data based on instrument type
                if (isIndex) {
                    data.marketBreadth = generateMarketBreadth(topic);
                } else {
                    data.stockData = generateStockData(topic, value);
                }
                
                ws.send(JSON.stringify({ type: topic, payload: data }));
            });
            
            // Handle client disconnection
            ws.on('close', () => {
                console.log('❌ Client disconnected');
                clients.delete(ws);
            });
            
            // Handle client messages
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    
                    // Handle subscription requests
                    if (data.type === 'subscribe') {
                        // Here you would handle specific subscriptions
                        console.log(`Client subscribed to: ${data.topics}`);
                    }
                    
                    // Handle unsubscription requests
                    if (data.type === 'unsubscribe') {
                        console.log(`Client unsubscribed from: ${data.topics}`);
                    }
                } catch (err) {
                    console.error('❌ Error processing client message:', err.message);
                }
            });
        });
        
        // Simulate and send data updates at different intervals for different instruments
        
        // Function to update and broadcast a single instrument
        function updateInstrument(topic) {
            // Get base value and current value
            const baseValue = BASE_VALUES[topic];
            const isIndex = INDEX_TOPICS.includes(topic);
            
            // Add volatility - higher for stocks, lower for indices
            const volatilityFactor = isIndex ? 0.001 : 0.003;
            const maxChange = baseValue * volatilityFactor;
            const change = (Math.random() * maxChange * 2) - maxChange;
            
            // Update current value but keep it within reasonable range
            currentValues[topic] = Math.max(baseValue * 0.7, Math.min(baseValue * 1.3, currentValues[topic] + change));
            const value = currentValues[topic].toFixed(2);
            
            // Create update packet
            const update = { 
                instrument: topic,
                type: INSTRUMENT_TYPES[topic],
                value, 
                timestamp: new Date().toISOString(), 
                change: change.toFixed(2),
                percentChange: (change / currentValues[topic] * 100).toFixed(2) + '%'
            };
            
            // Add option chain
            update.optionChain = generateOptionChain(topic, currentValues[topic]);
            
            // Add additional data based on instrument type
            if (isIndex) {
                update.marketBreadth = generateMarketBreadth(topic);
            } else {
                update.stockData = generateStockData(topic, currentValues[topic]);
            }
            
            // Send to Fluvio and broadcast to clients
            producers[topic].send(topic, JSON.stringify(update))
                .then(() => {
                    console.log(`📤 Sent ${topic}: ${value}`);
                    broadcast(topic, update);
                })
                .catch(err => console.error(`❌ Error sending to ${topic}:`, err.message));
        }
        
        // Update indices every 5 seconds
        setInterval(() => {
            INDEX_TOPICS.forEach(topic => updateInstrument(topic));
        }, 5000);
        
        // Update large cap stocks every 3 seconds
        setInterval(() => {
            const largeCaps = STOCK_TOPICS.filter(stock => MARKET_CAP[stock] === 'Large Cap');
            largeCaps.forEach(topic => updateInstrument(topic));
        }, 3000);
        
        // Update mid cap stocks every 5 seconds
        setInterval(() => {
            const midCaps = STOCK_TOPICS.filter(stock => MARKET_CAP[stock] === 'Mid Cap');
            midCaps.forEach(topic => updateInstrument(topic));
        }, 5000);
        
        // Update small cap stocks every 8 seconds
        setInterval(() => {
            const smallCaps = STOCK_TOPICS.filter(stock => MARKET_CAP[stock] === 'Small Cap');
            smallCaps.forEach(topic => updateInstrument(topic));
        }, 8000);
        
    } catch (err) {
        console.error('❌ Server error:', err);
    }
}

runServer();