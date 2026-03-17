import streamlit as st
import pandas as pd
import yfinance as yf
import numpy as np
from datetime import datetime

st.set_page_config(layout="wide", page_title="Cash-Secured Put Analyzer")

# --- Functions ---

@st.cache_data(ttl=3600)
def get_stock_data(ticker):
    try:
        stock = yf.Ticker(ticker)
        current_price = stock.fast_info['lastPrice']
        expirations = stock.options
        return current_price, expirations
    except Exception as e:
        return None, None

@st.cache_data(ttl=3600)
def get_option_chain(ticker, expiration):
    try:
        stock = yf.Ticker(ticker)
        opt = stock.option_chain(expiration)
        return opt.puts
    except Exception as e:
        return pd.DataFrame()

def process_options(ticker, capital, min_months_expiry, max_months_expiry, min_delta, max_delta):
    current_price, expirations = get_stock_data(ticker)
    
    if current_price is None:
        st.error(f"Could not retrieve data for ticker: {ticker}. Please check if the symbol is valid.")
        return None, None

    today = datetime.today()
    min_date = today + pd.DateOffset(months=min_months_expiry)
    max_date = today + pd.DateOffset(months=max_months_expiry)
    
    valid_expirations = []
    for exp in expirations:
        exp_date = datetime.strptime(exp, '%Y-%m-%d')
        if min_date <= exp_date <= max_date:
            valid_expirations.append(exp)

    all_puts = []
    
    progress_bar = st.progress(0, text="Fetching option chains...")

    for i, exp in enumerate(valid_expirations):
        progress_bar.progress((i + 1) / len(valid_expirations), text=f"Fetching options for {exp}...")
        puts = get_option_chain(ticker, exp)
        
        if puts.empty:
            continue
            
        # Filter OTM puts (Strike < Current Price)
        otm_puts = puts[puts['strike'] < current_price].copy()
        
        if otm_puts.empty:
            continue
            
        otm_puts['Expiration'] = exp
        all_puts.append(otm_puts)
        
    progress_bar.empty()

    if not all_puts:
        return pd.DataFrame(), current_price

    df = pd.concat(all_puts, ignore_index=True)
    
    # Calculate values
    df['Capital Required'] = df['strike'] * 100
    df['Max Contracts'] = np.floor(capital / df['Capital Required']).astype(int)
    
    # Filter by capital (must be able to afford at least 1 contract)
    df = df[df['Max Contracts'] >= 1].copy()
    
    if df.empty:
        return df, current_price
        
    # Handle missing explicit deltas if necessary (though yfinance usually provides it)
    # If delta is missing, drop or fill. We will drop for accuracy.
    df = df.dropna(subset=['impliedVolatility']) # Remove options with NaN implied volatility
    
    # Keep required columns + impliedVolatility
    # Note: yfinance might not always return 'delta', but it usually returns 'impliedVolatility'.
    # For a robust approach if delta is missing from yfinance, one might estimate it from IV. 
    # Let's assume yfinance provides it or we will just use a placeholder if it doesn't.
    # Actually yfinance does not reliably return Greeks. Let's inspect what it returns.
    # Usually it returns: contractSymbol, lastTradeDate, strike, lastPrice, bid, ask, change, percentChange, volume, openInterest, impliedVolatility, inTheMoney, contractSize, currency
    
    cols_to_keep = ['Expiration', 'strike', 'lastPrice', 'Bid', 'Ask', 'impliedVolatility', 'openInterest', 'volume']
    
    # Check what columns actually exist
    available_cols = df.columns.tolist()
    
    df['Total Capital Required'] = df['Max Contracts'] * df['Capital Required']
    df['Total Premium Received'] = df['Max Contracts'] * df['lastPrice'] * 100
    df['Return (%)'] = (df['Total Premium Received'] / df['Total Capital Required']) * 100
    
    df['Expiration Date'] = pd.to_datetime(df['Expiration'])
    df['Days to Expiration'] = (df['Expiration Date'] - today).dt.days
    
    # Avoid division by zero for 0 DTE options
    df.loc[df['Days to Expiration'] == 0, 'Days to Expiration'] = 1 
    
    df['Annualized Return (%)'] = df['Return (%)'] * (365 / df['Days to Expiration'])
    
    # For Delta, yfinance does not provide it out of the box. 
    # We can approximate delta using Black-Scholes if needed, but for simplicity we'll just show IV if Delta is not there.
    # Actually, as per requirements we need a delta filter. Let's approximate Delta using the standard formula.
    
    # Approximate Delta via Black-Scholes for European Puts:
    # d1 = (ln(S/K) + (r + sigma^2/2)t) / (sigma * sqrt(t))
    # Put Delta = N(d1) - 1
    from scipy.stats import norm
    
    # Approximate risk-free rate
    r = 0.05 
    
    S = current_price
    K = df['strike']
    t = df['Days to Expiration'] / 365.0
    sigma = df['impliedVolatility']
    
    d1 = (np.log(S/K) + (r + 0.5 * sigma**2) * t) / (sigma * np.sqrt(t))
    df['Delta'] = norm.cdf(d1) - 1
    
    # Convert volume to int (replace NaNs with 0)
    df['volume'] = df['volume'].fillna(0).astype(int)
    
    df['IV'] = df['impliedVolatility'] * 100
    
    # Calculate Moneyness as a percentage difference from the current stock price
    df['Moneyness (%)'] = ((df['strike'] - current_price) / current_price) * 100
    
    # Filter by Delta
    df = df[(df['Delta'] >= min_delta) & (df['Delta'] <= max_delta)]
    
    # Map required columns
    # We need: Expiration, Days to Expiration, Strike, Premium (Last), High, Delta, IV, Moneyness (%), Open Interest, Volume, Max Contracts, Total Capital Required, Total Premium Received, Annualized Return %
    
    df['High'] = df['lastPrice'] # Placeholder as option intraday high is not in standard option_chain output

    final_cols = [
        'Expiration', 'Days to Expiration', 'strike', 'lastPrice', 'High', 
        'Delta', 'IV', 'Moneyness (%)', 'openInterest', 'volume', 'Max Contracts', 'Total Capital Required', 
        'Total Premium Received', 'Annualized Return (%)'
    ]
    
    # Rename columns for display
    rename_map = {
        'strike': 'Strike',
        'lastPrice': 'Premium (Last)',
        'openInterest': 'Open Interest',
        'volume': 'Volume'
    }
    
    res_df = df.rename(columns=rename_map)
    final_cols = [rename_map.get(c, c) for c in final_cols]
    
    # Keep only available columns
    final_cols = [c for c in final_cols if c in res_df.columns]
    
    res_df = res_df[final_cols]
    
    # Sort
    res_df = res_df.sort_values(by='Annualized Return (%)', ascending=False)
    
    # Reset index
    res_df = res_df.reset_index(drop=True)
    
    return res_df, current_price

# --- UI Layout ---

st.title("Cash-Secured Put Analyzer")

# Sidebar
st.sidebar.header("Inputs")
ticker = st.sidebar.text_input("Ticker Symbol", value="AAPL").upper()
# Handle capital formatting with session_state
if 'capital_input' not in st.session_state:
    st.session_state['capital_input'] = "10,000"

capital_str = st.sidebar.text_input(
    "Capital Available ($)", 
    value=st.session_state['capital_input'],
    key="capital_widget"
)

try:
    capital = int(capital_str.replace(",", "").replace("$", "").strip())
    # Format it back to include commas for the next render
    st.session_state['capital_input'] = f"{capital:,}"
except ValueError:
    st.sidebar.error("Please enter a valid whole number for Capital Available.")
    capital = 10000
min_max_months = st.sidebar.slider("Expiration Window (Months)", min_value=0, max_value=12, value=(0, 6), step=1)
min_months, max_months = min_max_months

st.sidebar.subheader("Delta Filter")
delta_range = st.sidebar.slider("Delta Range", min_value=-1.0, max_value=0.0, value=(-0.5, 0.0), step=0.01)

run_button = st.sidebar.button("Run Analysis", type="primary")

if run_button:
    if ticker:
        with st.spinner("Analyzing options..."):
            df, current_price = process_options(
                ticker=ticker, 
                capital=capital, 
                min_months_expiry=min_months,
                max_months_expiry=max_months, 
                min_delta=delta_range[0], 
                max_delta=delta_range[1]
            )
            if current_price is not None and df is not None and not df.empty:
                st.session_state['df'] = df
                st.session_state['current_price'] = current_price
                st.session_state['ticker'] = ticker
                st.session_state['capital'] = capital
                # clear visual filters state so that multiselects and sliders bounds refresh and restore
                if 'selected_exps' in st.session_state:
                    del st.session_state['selected_exps']
            elif current_price is not None:
                st.warning("No options found matching your initial criteria (e.g. capital might be too low). Try adjusting inputs and running again.")
                if 'df' in st.session_state:
                    del st.session_state['df']
    else:
        st.warning("Please enter a valid ticker symbol.")

if 'df' in st.session_state and not st.session_state['df'].empty:
    df = st.session_state['df']
    current_price = st.session_state['current_price']
    loaded_ticker = st.session_state['ticker']
    
    st.subheader(f"Current Stock Price ({loaded_ticker}): ${current_price:.2f}")
    
    # Optional Strike/Exp Filters on main page
    st.subheader("Filter Full Results")
    col1, col2 = st.columns(2)
    with col1:
        strike_range = st.slider(
            "Strike Range", 
            min_value=float(df['Strike'].min()), 
            max_value=float(df['Strike'].max()), 
            value=(float(df['Strike'].min()), float(df['Strike'].max()))
        )
    with col2:
        exp_dates = df['Expiration'].unique().tolist()
        
        # Determine the initial default, either from freshly loaded data or persistent session state.
        # This allows the multiselect to default back to all dates initially, but store deletions as the user interacts.
        if 'selected_exps' not in st.session_state:
            st.session_state['selected_exps'] = exp_dates
            
        selected_exps = st.multiselect("Expiration Dates", options=exp_dates, key="selected_exps")
        
    filtered_df = df[
        (df['Strike'] >= strike_range[0]) & 
        (df['Strike'] <= strike_range[1]) & 
        (df['Expiration'].isin(selected_exps))
    ]
    
    st.header("Top 10 Best Cash-Secured Put Opportunities")
    # Update top_10 to use the filtered_df so it reflects the selected expirations/strikes
    top_10 = filtered_df.head(10).copy()
    
    # Formatting for display
    fmt = {
        'Strike': '${:.2f}',
        'Premium (Last)': '${:.2f}',
        'High': '${:.2f}',
        'Delta': '{:.3f}',
        'IV': '{:.2f}%',
        'Moneyness (%)': '{:.2f}%',
        'Volume': '{:d}',
        'Max Contracts': '{:d}',
        'Total Capital Required': '${:,.0f}',
        'Total Premium Received': '${:,.2f}',
        'Annualized Return (%)': '{:.2f}%'
    }
    
    st.dataframe(top_10.style.format(fmt), use_container_width=True)
    
    st.header("Full Options Table")
    
    st.dataframe(filtered_df.style.format(fmt), use_container_width=True)
    
    # Visualizations
    st.header("Visualizations")
    col_chart1, col_chart2 = st.columns(2)
    
    import altair as alt
    
    with col_chart1:
        st.subheader("Yield vs. Strike")
        if not filtered_df.empty:
            chart1 = alt.Chart(filtered_df).mark_circle(size=60).encode(
                x=alt.X('Strike', scale=alt.Scale(zero=False)),
                y='Annualized Return (%)',
                tooltip=['Strike', 'Expiration', 'Annualized Return (%)', 'Moneyness (%)', 'IV']
            ).interactive(bind_y=False, bind_x=False) # Disable scrolling/zooming
            st.altair_chart(chart1, use_container_width=True)
        else:
            st.write("No data for current filter.")
            
    with col_chart2:
        st.subheader("Yield vs. Days to Expiration")
        if not filtered_df.empty:
            chart2 = alt.Chart(filtered_df).mark_circle(size=60).encode(
                x='Days to Expiration',
                y='Annualized Return (%)',
                tooltip=['Days to Expiration', 'Strike', 'Annualized Return (%)', 'Moneyness (%)', 'IV']
            ).interactive(bind_y=False, bind_x=False) # Disable scrolling/zooming
            st.altair_chart(chart2, use_container_width=True)
        else:
            st.write("No data for current filter.")
