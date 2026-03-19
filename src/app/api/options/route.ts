import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { calculatePutDelta } from '@/lib/math';
import { addMonths, isWithinInterval } from 'date-fns';

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker')?.toUpperCase() || 'AAPL';
  const capital = parseFloat(searchParams.get('capital') || '10000');
  const minMonths = parseInt(searchParams.get('minMonths') || '0');
  const maxMonths = parseInt(searchParams.get('maxMonths') || '6');
  const minDelta = parseFloat(searchParams.get('minDelta') || '-0.5');
  const maxDelta = parseFloat(searchParams.get('maxDelta') || '0');

  try {
    // 1. Get current price
    const quote = await yahooFinance.quote(ticker);
    if (!quote || !quote.regularMarketPrice) {
      return NextResponse.json({ error: `Ticker ${ticker} not found` }, { status: 404 });
    }
    const currentPrice = quote.regularMarketPrice;

    // 2. Get available expirations
    const optionMetaData = await yahooFinance.options(ticker);
    if (!optionMetaData || !optionMetaData.expirationDates) {
        return NextResponse.json({ error: 'No options data found' }, { status: 404 });
    }

    const today = new Date();
    const minDate = addMonths(today, minMonths);
    const maxDate = addMonths(today, maxMonths);

    // Filter expirations within the window
    const validExpirations = optionMetaData.expirationDates.filter((expDate: Date) => {
      return isWithinInterval(expDate, { start: minDate, end: maxDate });
    });

    if (validExpirations.length === 0) {
      return NextResponse.json({ 
        ticker, 
        currentPrice, 
        options: [], 
        message: 'No expirations found in the selected range.' 
      });
    }

    // 3. Fetch chains in parallel
    const chainsResults = await Promise.all(
      validExpirations.map(async (expDate: Date) => {
        try {
          const chain = await yahooFinance.options(ticker, { date: expDate });
          return { expDate, chain };
        } catch (err) {
          console.error(`Error fetching chain for ${expDate}:`, err);
          return null;
        }
      })
    );

    const allPuts: any[] = [];
    const riskFreeRate = 0.05;

    chainsResults.forEach((res) => {
      if (!res || !res.chain || !res.chain.options || res.chain.options.length === 0) return;
      
      const { expDate, chain } = res;
      const puts = chain.options[0].puts; 
      const expirationDateStr = expDate.toISOString().split('T')[0];
      const daysToExpiration = Math.max(1, Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
      const t = daysToExpiration / 365.0;

      puts.forEach((put: any) => {
        // Filter OTM (Strike < Current Price)
        if (put.strike >= currentPrice) return;

        const capitalRequired = put.strike * 100;
        const maxContracts = Math.floor(capital / capitalRequired);
        // We no longer return early if maxContracts < 1
        // This allows the UI to show the full range of strikes for the stock price
        // even if the user can't afford them with current capital.

        const sigma = put.impliedVolatility || 0;
        if (sigma <= 0) return;

        const delta = calculatePutDelta(currentPrice, put.strike, t, sigma, riskFreeRate);

        // Filter by Delta
        if (delta < minDelta || delta > maxDelta) return;

        const totalCapitalRequired = maxContracts * capitalRequired;
        const totalPremiumReceived = maxContracts * put.lastPrice * 100;
        const returnPct = (totalPremiumReceived / totalCapitalRequired) * 100;
        const annualizedReturnPct = returnPct * (365 / daysToExpiration);

        allPuts.push({
          expiration: expirationDateStr,
          daysToExpiration,
          strike: put.strike,
          lastPrice: put.lastPrice,
          high: put.lastPrice, 
          delta,
          iv: sigma * 100,
          moneyness: ((put.strike - currentPrice) / currentPrice) * 100,
          openInterest: put.openInterest || 0,
          volume: put.volume || 0,
          maxContracts,
          totalCapitalRequired,
          totalPremiumReceived,
          annualizedReturn: annualizedReturnPct
        });
      });
    });

    // Sort by annualized return descending
    allPuts.sort((a, b) => b.annualizedReturn - a.annualizedReturn);

    return NextResponse.json({
      ticker,
      currentPrice,
      options: allPuts
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
