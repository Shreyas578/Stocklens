// Global variables to store data
let stocksData = {};
let indicesData = {};
let priceHistory = {};
let currentInstrument = null;
let socket = null;
let chart = null;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const indicesContainer = document.getElementById('indices-container');
const stocksBySectorContainer = document.getElementById('stocks-by-sector');
const noResultsElement = document.getElementById('no-results');
const connectionStatus = document.getElementById('connection-status');
const detailModal = document.getElementById('detail-modal');
const aboutModal = document.getElementById('about-modal');

// Connect to WebSocket server
function connectWebSocket() {
    socket = new WebSocket('ws://localhost:3001');

    socket.onopen = () => {
        console.log('Connected to WebSocket server');
        connectionStatus.textContent = 'Live Data';
        connectionStatus.classList.remove('disconnected');
        connectionStatus.classList.add('connected');
    };

    socket.onclose = () => {
        console.log('Disconnected from WebSocket server');
        connectionStatus.textContent = 'Disconnected';
        connectionStatus.classList.remove('connected');
        connectionStatus.classList.add('disconnected');
        
        // Try to reconnect after 5 seconds
        setTimeout(connectWebSocket, 5000);
    };

    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    socket.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            const instrumentData = message.payload;

            // Store data and update UI
            if (instrumentData.type === 'index') {
                indicesData[instrumentData.instrument] = instrumentData;
                updateIndicesUI();
            } else {
                stocksData[instrumentData.instrument] = instrumentData;
                updateStocksBySectorUI();
            }

            // If this is the current instrument being viewed, update the detail view
            if (currentInstrument === instrumentData.instrument) {
                updateDetailView(instrumentData);
            }

            // Update price history for charts
            if (!priceHistory[instrumentData.instrument]) {
                priceHistory[instrumentData.instrument] = [];
            }
            
            priceHistory[instrumentData.instrument].push({
                time: new Date(),
                value: parseFloat(instrumentData.value)
            });

            // Keep only the last 100 points
            if (priceHistory[instrumentData.instrument].length > 100) {
                priceHistory[instrumentData.instrument] = priceHistory[instrumentData.instrument].slice(-100);
            }

            // Update chart if it's the current instrument
            if (currentInstrument === instrumentData.instrument && chart) {
                updateChart();
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    };
}

// Format instrument name for display
function formatInstrumentName(name) {
    return name.split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Format currency with Indian number system
function formatCurrency(value) {
    return new Intl.NumberFormat('en-IN', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
    }).format(value);
}

// Create a stock tile element
function createStockTile(data) {
    const isPositive = !data.change.startsWith('-');
    const displayName = formatInstrumentName(data.instrument);
    
    const tile = document.createElement('div');
    tile.className = `stock-tile ${isPositive ? 'positive' : 'negative'}`;
    tile.dataset.instrument = data.instrument;
    
    tile.innerHTML = `
        <div class="tile-header">
            <div>
                <div class="tile-name">${displayName}</div>
                <div class="tile-type">${data.type}</div>
            </div>
            <div class="tile-badge ${isPositive ? 'positive-badge' : 'negative-badge'}">
                <i class="fas fa-${isPositive ? 'arrow-up' : 'arrow-down'} fa-xs" style="margin-right: 4px;"></i>
                ${data.percentChange}
            </div>
        </div>
        <div class="tile-price">
            <span class="price-value">₹${formatCurrency(parseFloat(data.value))}</span>
            <span class="price-change ${isPositive ? 'positive-change' : 'negative-change'}">${data.change}</span>
        </div>
        
        <!-- Additional info based on type -->
        ${data.type === 'stock' && data.stockData ? `
            <div class="tile-info">
                <div class="tile-info-item">
                    Sector: <span>${data.stockData.sector}</span>
                </div>
                <div class="tile-info-item">
                    Cap: <span>${data.stockData.marketCapCategory}</span>
                </div>
            </div>
        ` : ''}
        
        ${data.type === 'index' && data.marketBreadth ? `
            <div class="tile-info">
                <div class="tile-info-item">
                    Adv: <span class="positive-change">${data.marketBreadth.advancers}</span>
                </div>
                <div class="tile-info-item">
                    Dec: <span class="negative-change">${data.marketBreadth.decliners}</span>
                </div>
            </div>
        ` : ''}
        
        <div class="tile-icon">
            <i class="fas fa-chart-line"></i>
        </div>
    `;
    
    // Add click event to open detail modal
    tile.addEventListener('click', () => {
        openDetailModal(data.instrument);
    });
    
    return tile;
}

// Update indices UI
function updateIndicesUI() {
    // Clear container
    indicesContainer.innerHTML = '';
    
    // Get filtered indices based on search
    const searchTerm = searchInput.value.toLowerCase();
    const filteredIndices = Object.values(indicesData).filter(index => 
        index.instrument.toLowerCase().includes(searchTerm)
    );
    
    // Add tiles to container
    filteredIndices.forEach(index => {
        indicesContainer.appendChild(createStockTile(index));
    });
    
    // Check if we need to show no results message
    checkNoResults();
}

// Update stocks by sector UI
function updateStocksBySectorUI() {
    // Clear container
    stocksBySectorContainer.innerHTML = '';
    
    // Get filtered stocks based on search
    const searchTerm = searchInput.value.toLowerCase();
    const filteredStocks = Object.values(stocksData).filter(stock => 
        stock.instrument.toLowerCase().includes(searchTerm)
    );
    
    // Group stocks by sector
    const stocksBySector = {};
    filteredStocks.forEach(stock => {
        const sector = stock.stockData?.sector || 'Other';
        if (!stocksBySector[sector]) {
            stocksBySector[sector] = [];
        }
        stocksBySector[sector].push(stock);
    });
    
    // Create section for each sector
    Object.entries(stocksBySector).forEach(([sector, sectorStocks]) => {
        const sectionElement = document.createElement('section');
        sectionElement.innerHTML = `
            <h2>${sector}</h2>
            <div class="tiles-container" id="sector-${sector.toLowerCase().replace(/\s+/g, '-')}"></div>
        `;
        
        stocksBySectorContainer.appendChild(sectionElement);
        
        const sectorContainer = sectionElement.querySelector('.tiles-container');
        sectorStocks.forEach(stock => {
            sectorContainer.appendChild(createStockTile(stock));
        });
    });
    
    // Check if we need to show no results message
    checkNoResults();
}

// Check if we need to show no results message
function checkNoResults() {
    const searchTerm = searchInput.value.toLowerCase();
    const hasIndices = Object.values(indicesData).some(index => 
        index.instrument.toLowerCase().includes(searchTerm)
    );
    const hasStocks = Object.values(stocksData).some(stock => 
        stock.instrument.toLowerCase().includes(searchTerm)
    );
    
    if (!hasIndices && !hasStocks && searchTerm) {
        noResultsElement.classList.remove('hidden');
    } else {
        noResultsElement.classList.add('hidden');
    }
}

// Open detail modal
function openDetailModal(instrumentId) {
    currentInstrument = instrumentId;
    
    // Get instrument data
    const data = indicesData[instrumentId] || stocksData[instrumentId];
    if (!data) return;
    
    // Update modal content
    updateDetailView(data);
    
    // Show modal
    detailModal.style.display = 'block';
    
    // Initialize chart
    initChart();
}

// Update detail view
function updateDetailView(data) {
    const isPositive = !data.change.startsWith('-');
    const displayName = formatInstrumentName(data.instrument);
    
    // Update header
    document.getElementById('detail-title').textContent = `${displayName} Details`;
    document.getElementById('detail-name').textContent = displayName;
    document.getElementById('detail-type').textContent = `${data.type} • ${data.stockData?.sector || 'Index'}`;
    document.getElementById('detail-price').textContent = `₹${formatCurrency(parseFloat(data.value))}`;
    
    const changeElement = document.getElementById('detail-change');
    changeElement.textContent = `${data.change} (${data.percentChange})`;
    changeElement.className = `detail-change ${isPositive ? 'positive-change' : 'negative-change'}`;
    changeElement.innerHTML = `
        <i class="fas fa-${isPositive ? 'arrow-up' : 'arrow-down'}" style="margin-right: 4px;"></i>
        ${data.change} (${data.percentChange})
    `;
    
    // Update market data
    const marketDataContent = document.getElementById('market-data-content');
    
    if (data.type === 'stock' && data.stockData) {
        marketDataContent.innerHTML = `
            <div class="data-grid">
                <div class="data-item">
                    <div class="data-item-label">Day High</div>
                    <div class="data-item-value">₹${data.stockData.dayHigh}</div>
                </div>
                <div class="data-item">
                    <div class="data-item-label">Day Low</div>
                    <div class="data-item-value">₹${data.stockData.dayLow}</div>
                </div>
                <div class="data-item">
                    <div class="data-item-label">52W High</div>
                    <div class="data-item-value">₹${data.stockData.yearHigh}</div>
                </div>
                <div class="data-item">
                    <div class="data-item-label">52W Low</div>
                    <div class="data-item-value">₹${data.stockData.yearLow}</div>
                </div>
            </div>
            
            <div class="data-list">
                <div class="data-list-item">
                    <span class="data-list-label">Volume</span>
                    <span class="data-list-value">${data.stockData.volume.toLocaleString()}</span>
                </div>
                <div class="data-list-item">
                    <span class="data-list-label">Value Traded</span>
                    <span class="data-list-value">${data.stockData.valueTraded}</span>
                </div>
                <div class="data-list-item">
                    <span class="data-list-label">P/E Ratio</span>
                    <span class="data-list-value">${data.stockData.pe}</span>
                </div>
                <div class="data-list-item">
                    <span class="data-list-label">Market Cap</span>
                    <span class="data-list-value">${data.stockData.marketCap}</span>
                </div>
                <div class="data-list-item">
                    <span class="data-list-label">Category</span>
                    <span class="data-list-value">${data.stockData.marketCapCategory}</span>
                </div>
                <div class="data-list-item">
                    <span class="data-list-label">Lot Size</span>
                    <span class="data-list-value">${data.stockData.lotSize}</span>
                </div>
            </div>
        `;
    } else if (data.type === 'index' && data.marketBreadth) {
        marketDataContent.innerHTML = `
            <div class="data-grid">
                <div class="data-item" style="background-color: var(--success-light);">
                    <div class="data-item-label">Advancers</div>
                    <div class="data-item-value" style="color: var(--success-color);">${data.marketBreadth.advancers}</div>
                </div>
                <div class="data-item" style="background-color: var(--danger-light);">
                    <div class="data-item-label">Decliners</div>
                    <div class="data-item-value" style="color: var(--danger-color);">${data.marketBreadth.decliners}</div>
                </div>
                <div class="data-item">
                    <div class="data-item-label">Unchanged</div>
                    <div class="data-item-value">${data.marketBreadth.unchanged}</div>
                </div>
            </div>
            
            <div class="data-list">
                <div class="data-list-item">
                    <span class="data-list-label">Total Volume</span>
                    <span class="data-list-value">${data.marketBreadth.totalVolume}</span>
                </div>
                <div class="data-list-item">
                    <span class="data-list-label">Adv/Dec Ratio</span>
                    <span class="data-list-value">${data.marketBreadth.adv_dec_ratio}</span>
                </div>
                <div class="data-list-item">
                    <span class="data-list-label">Market Width</span>
                    <span class="data-list-value">${data.marketBreadth.marketWidth}</span>
                </div>
            </div>
        `;
    }
    
    // Update option chain
    const optionChainSection = document.getElementById('option-chain-section');
    
    if (data.optionChain) {
        optionChainSection.style.display = 'block';
        
        // Update calls table
        const callsTable = document.getElementById('calls-table').querySelector('tbody');
        callsTable.innerHTML = '';
        
        data.optionChain.calls.forEach(option => {
            const isPositive = !option.change.startsWith('-');
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>₹${formatCurrency(option.strike)}</td>
                <td>₹${option.price}</td>
                <td class="${isPositive ? 'positive-change' : 'negative-change'}">
                    <i class="fas fa-${isPositive ? 'arrow-up' : 'arrow-down'} fa-xs" style="margin-right: 4px;"></i>
                    ${option.change}
                </td>
                <td>${option.iv}</td>
                <td>${option.oi.toLocaleString()}</td>
                <td>${option.volume.toLocaleString()}</td>
            `;
            callsTable.appendChild(row);
        });
        
        // Update puts table
        const putsTable = document.getElementById('puts-table').querySelector('tbody');
        putsTable.innerHTML = '';
        
        data.optionChain.puts.forEach(option => {
            const isPositive = !option.change.startsWith('-');
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>₹${formatCurrency(option.strike)}</td>
                <td>₹${option.price}</td>
                <td class="${isPositive ? 'positive-change' : 'negative-change'}">
                    <i class="fas fa-${isPositive ? 'arrow-up' : 'arrow-down'} fa-xs" style="margin-right: 4px;"></i>
                    ${option.change}
                </td>
                <td>${option.iv}</td>
                <td>${option.oi.toLocaleString()}</td>
                <td>${option.volume.toLocaleString()}</td>
            `;
            putsTable.appendChild(row);
        });
    } else {
        optionChainSection.style.display = 'none';
    }
    
    // Set up about button
    document.getElementById('about-button').onclick = () => {
        openAboutModal(data.instrument);
    };
}

// Initialize price chart
function initChart() {
    const chartCanvas = document.getElementById('price-chart');
    const chartWaiting = document.getElementById('chart-waiting');
    
    // Check if we have price history
    if (!priceHistory[currentInstrument] || priceHistory[currentInstrument].length < 2) {
        chartCanvas.style.display = 'none';
        chartWaiting.style.display = 'flex';
        return;
    }
    
    chartCanvas.style.display = 'block';
    chartWaiting.style.display = 'none';
    
    // Destroy existing chart if it exists
    if (chart) {
        chart.destroy();
    }
    
    // Create new chart
    updateChart();
}

// Update price chart
function updateChart() {
    if (!priceHistory[currentInstrument] || priceHistory[currentInstrument].length < 2) return;
    
    const chartCanvas = document.getElementById('price-chart');
    const chartWaiting = document.getElementById('chart-waiting');
    
    chartCanvas.style.display = 'block';
    chartWaiting.style.display = 'none';
    
    const history = priceHistory[currentInstrument];
    const isPositive = history[history.length - 1].value >= history[0].value;
    const lineColor = isPositive ? '#10b981' : '#ef4444';
    
    // Format data for chart
    const labels = history.map(point => {
        const time = new Date(point.time);
        return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });
    
    const data = history.map(point => point.value);
    
    // Destroy existing chart if it exists
    if (chart) {
        chart.destroy();
    }
    
    // Create new chart
    chart = new Chart(chartCanvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Price',
                data: data,
                borderColor: lineColor,
                backgroundColor: 'rgba(0, 0, 0, 0)',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointHoverBackgroundColor: lineColor,
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `₹${formatCurrency(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: '#f0f0f0'
                    },
                    ticks: {
                        maxRotation: 0
                    }
                },
                y: {
                    grid: {
                        color: '#f0f0f0'
                    },
                    ticks: {
                        callback: function(value) {
                            return `₹${formatCurrency(value)}`;
                        }
                    }
                }
            }
        }
    });
}

// Mock company information since it's not provided by the backend
const companyInfo = {
    'reliance': {
        name: 'Reliance Industries Limited',
        description: 'Reliance Industries Limited is an Indian multinational conglomerate company, headquartered in Mumbai. It has diverse businesses including energy, petrochemicals, natural gas, retail, telecommunications, mass media, and textiles.',
        founded: '1966',
        founder: 'Dhirubhai Ambani',
        ceo: 'Mukesh Ambani',
        headquarters: 'Mumbai, Maharashtra, India',
        employees: '195,000+',
        website: 'www.ril.com'
    },
    'tcs': {
        name: 'Tata Consultancy Services',
        description: 'Tata Consultancy Services Limited is an Indian multinational information technology services and consulting company headquartered in Mumbai. It is a subsidiary of the Tata Group and operates in 149 locations across 46 countries.',
        founded: '1968',
        founder: 'Tata Group',
        ceo: 'K Krithivasan',
        headquarters: 'Mumbai, Maharashtra, India',
        employees: '600,000+',
        website: 'www.tcs.com'
    }
};

// Generate generic company info for stocks without specific data
function generateCompanyInfo(stockName, sector, marketCap) {
    const displayName = formatInstrumentName(stockName);
    
    return {
        name: `${displayName} Ltd.`,
        description: `${displayName} is a leading company in the ${sector} sector in India. The company has established a strong market presence and continues to innovate in its field.`,
        founded: `${1960 + Math.floor(Math.random() * 50)}`,
        founder: 'Various Entrepreneurs',
        ceo: 'Professional Management',
        headquarters: 'Major Indian City',
        employees: `${Math.floor(Math.random() * 100) + 1},000+`,
        website: `www.${stockName}.com`
    };
}

// Mock index information
const indexInfo = {
    'nifty-50': {
        name: 'NIFTY 50',
        description: 'The NIFTY 50 is the flagship index on the National Stock Exchange of India (NSE). The Index tracks the behavior of a portfolio of blue chip companies, the largest and most liquid Indian securities.',
        launched: '1996',
        methodology: 'Free-float market capitalization weighted',
        components: '50 stocks',
        rebalancing: 'Semi-annual',
        baseValue: '1000 (November 3, 1995)',
        operator: 'NSE Indices Limited'
    },
    'sensex': {
        name: 'S&P BSE SENSEX',
        description: 'The S&P BSE SENSEX is a free-float market-weighted stock market index of 30 well-established and financially sound companies listed on the Bombay Stock Exchange (BSE).',
        launched: '1986',
        methodology: 'Free-float market capitalization weighted',
        components: '30 stocks',
        rebalancing: 'Semi-annual',
        baseValue: '100 (1978-79)',
        operator: 'BSE Ltd'
    }
};

// Generate generic index info for indices without specific data
function generateIndexInfo(indexName) {
    const displayName = formatInstrumentName(indexName);
    
    return {
        name: displayName.toUpperCase(),
        description: `The ${displayName.toUpperCase()} is a major stock market index that tracks the performance of selected companies listed on Indian stock exchanges.`,
        launched: `${1990 + Math.floor(Math.random() * 20)}`,
        methodology: 'Free-float market capitalization weighted',
        components: `${Math.floor(Math.random() * 50) + 10} stocks`,
        rebalancing: 'Semi-annual',
        baseValue: '1000',
        operator: 'Major Indian Exchange'
    };
}

// Open about modal
function openAboutModal(instrumentId) {
    // Get instrument data
    const data = indicesData[instrumentId] || stocksData[instrumentId];
    if (!data) return;
    
    // Get info data
    let info;
    if (data.type === 'stock') {
        info = companyInfo[data.instrument] || 
               generateCompanyInfo(data.instrument, data.stockData?.sector || 'Various', data.stockData?.marketCap || 'Unknown');
    } else {
        info = indexInfo[data.instrument] || generateIndexInfo(data.instrument);
    }
    
    // Update modal content
    const displayName = formatInstrumentName(data.instrument);
    
    document.getElementById('about-title').textContent = `About ${info.name}`;
    document.getElementById('about-name').textContent = info.name;
    document.getElementById('about-type').textContent = data.type === 'stock' ? 
        `${data.stockData?.sector || 'Stock'} • ${data.stockData?.marketCapCategory || ''}` : 
        'Market Index';
    document.getElementById('about-description').textContent = info.description;
    
    // Update info grid
    const infoGrid = document.getElementById('about-info-grid');
    
    if (data.type === 'stock') {
        infoGrid.innerHTML = `
            <div class="info-item">
                <div class="info-icon blue">
                    <i class="fas fa-building"></i>
                </div>
                <div class="info-content">
                    <div class="info-label">Founded</div>
                    <div class="info-value">${info.founded}</div>
                </div>
            </div>
            <div class="info-item">
                <div class="info-icon green">
                    <i class="fas fa-users"></i>
                </div>
                <div class="info-content">
                    <div class="info-label">Employees</div>
                    <div class="info-value">${info.employees}</div>
                </div>
            </div>
            <div class="info-item">
                <div class="info-icon purple">
                    <i class="fas fa-dollar-sign"></i>
                </div>
                <div class="info-content">
                    <div class="info-label">Market Cap</div>
                    <div class="info-value">${data.stockData?.marketCap || 'N/A'}</div>
                </div>
            </div>
            <div class="info-item">
                <div class="info-icon amber">
                    <i class="fas fa-user-tie"></i>
                </div>
                <div class="info-content">
                    <div class="info-label">CEO</div>
                    <div class="info-value">${info.ceo}</div>
                </div>
            </div>
        `;
    } else {
        infoGrid.innerHTML = `
            <div class="info-item">
                <div class="info-icon blue">
                    <i class="fas fa-calendar-alt"></i>
                </div>
                <div class="info-content">
                    <div class="info-label">Launched</div>
                    <div class="info-value">${info.launched}</div>
                </div>
            </div>
            <div class="info-item">
                <div class="info-icon green">
                    <i class="fas fa-chart-line"></i>
                </div>
                <div class="info-content">
                    <div class="info-label">Methodology</div>
                    <div class="info-value">${info.methodology}</div>
                </div>
            </div>
            <div class="info-item">
                <div class="info-icon purple">
                    <i class="fas fa-layer-group"></i>
                </div>
                <div class="info-content">
                    <div class="info-label">Components</div>
                    <div class="info-value">${info.components}</div>
                </div>
            </div>
            <div class="info-item">
                <div class="info-icon amber">
                    <i class="fas fa-building"></i>
                </div>
                <div class="info-content">
                    <div class="info-label">Operator</div>
                    <div class="info-value">${info.operator}</div>
                </div>
            </div>
        `;
    }
    
    // Update overview tab
    const overviewContent = document.getElementById('overview-content');
    
    if (data.type === 'stock') {
        overviewContent.innerHTML = `
            <div class="data-list">
                <div class="data-list-item">
                    <span class="data-list-label">Sector</span>
                    <span class="data-list-value">${data.stockData?.sector || 'N/A'}</span>
                </div>
                <div class="data-list-item">
                    <span class="data-list-label">Category</span>
                    <span class="data-list-value">${data.stockData?.marketCapCategory || 'N/A'}</span>
                </div>
                <div class="data-list-item">
                    <span class="data-list-label">P/E Ratio</span>
                    <span class="data-list-value">${data.stockData?.pe || 'N/A'}</span>
                </div>
                <div class="data-list-item">
                    <span class="data-list-label">Headquarters</span>
                    <span class="data-list-value">${info.headquarters}</span>
                </div>
                <div class="data-list-item">
                    <span class="data-list-label">Website</span>
                    <span class="data-list-value">${info.website}</span>
                </div>
            </div>
        `;
    } else {
        overviewContent.innerHTML = `
            <div class="data-list">
                <div class="data-list-item">
                    <span class="data-list-label">Base Value</span>
                    <span class="data-list-value">${info.baseValue}</span>
                </div>
                <div class="data-list-item">
                    <span class="data-list-label">Rebalancing</span>
                    <span class="data-list-value">${info.rebalancing}</span>
                </div>
                <div class="data-list-item">
                    <span class="data-list-label">Total Components</span>
                    <span class="data-list-value">${info.components}</span>
                </div>
            </div>
        `;
    }
    
    // Update details tab
    const detailsContent = document.getElementById('details-content');
    
    if (data.type === 'stock') {
        detailsContent.innerHTML = `
            <div class="data-list">
                <div class="data-list-item">
                    <span class="data-list-label">52W High</span>
                    <span class="data-list-value">₹${data.stockData?.yearHigh || 'N/A'}</span>
                </div>
                <div class="data-list-item">
                    <span class="data-list-label">52W Low</span>
                    <span class="data-list-value">₹${data.stockData?.yearLow || 'N/A'}</span>
                </div>
                <div class="data-list-item">
                    <span class="data-list-label">Lot Size</span>
                    <span class="data-list-value">${data.stockData?.lotSize || 'N/A'}</span>
                </div>
                <div class="data-list-item">
                    <span class="data-list-label">Founder</span>
                    <span class="data-list-value">${info.founder}</span>
                </div>
            </div>
        `;
    } else {
        detailsContent.innerHTML = `
            <div class="data-list">
                <div class="data-list-item">
                    <span class="data-list-label">Advancers</span>
                    <span class="data-list-value">${data.marketBreadth?.advancers || 'N/A'}</span>
                </div>
                <div class="data-list-item">
                    <span class="data-list-label">Decliners</span>
                    <span class="data-list-value">${data.marketBreadth?.decliners || 'N/A'}</span>
                </div>
                <div class="data-list-item">
                    <span class="data-list-label">Adv/Dec Ratio</span>
                    <span class="data-list-value">${data.marketBreadth?.adv_dec_ratio || 'N/A'}</span>
                </div>
                <div class="data-list-item">
                    <span class="data-list-label">Market Width</span>
                    <span class="data-list-value">${data.marketBreadth?.marketWidth || 'N/A'}</span>
                </div>
            </div>
        `;
    }
    
    // Set up back button
    document.getElementById('back-to-detail-button').onclick = () => {
        closeAboutModal();
    };
    
    // Hide detail modal and show about modal
    detailModal.style.display = 'none';
    aboutModal.style.display = 'block';
}

// Close detail modal
function closeDetailModal() {
    detailModal.style.display = 'none';
    currentInstrument = null;
    
    // Destroy chart
    if (chart) {
        chart.destroy();
        chart = null;
    }
}

// Close about modal
function closeAboutModal() {
    aboutModal.style.display = 'none';
    detailModal.style.display = 'block';
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Connect to WebSocket
    connectWebSocket();
    
    // Search input
    searchInput.addEventListener('input', () => {
        updateIndicesUI();
        updateStocksBySectorUI();
    });
    
    // Close buttons
    document.querySelectorAll('.close-button').forEach(button => {
        button.addEventListener('click', () => {
            closeDetailModal();
            closeAboutModal();
        });
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === detailModal) {
            closeDetailModal();
        }
        if (event.target === aboutModal) {
            closeAboutModal();
        }
    });
    
    // Tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            const tabContainer = button.closest('.tabs').nextElementSibling;
            
            // Deactivate all tabs
            button.closest('.tabs').querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
            });
            tabContainer.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.remove('active');
            });
            
            // Activate selected tab
            button.classList.add('active');
            tabContainer.querySelector(`#${tabId}-tab`).classList.add('active');
        });
    });
});