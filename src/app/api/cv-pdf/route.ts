import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export async function GET(request: Request) {
  try {
    const isDev = process.env.NODE_ENV === 'development';
    
    const browser = await puppeteer.launch({
      args: isDev 
        ? ['--no-sandbox', '--disable-setuid-sandbox']
        : chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: isDev
        ? process.platform === 'win32'
          ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
          : process.platform === 'darwin'
          ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
          : '/usr/bin/google-chrome'
        : await chromium.executablePath(),
      headless: chromium.headless,
    });
    const page = await browser.newPage();

    // Get the host from the request to work in both local and deployed environments
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const url = `${protocol}://${host}/cv`;

    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    // Set PDF metadata - must be done before pdf generation
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(document, 'title', {
        get() { return 'Bryan Min - Curriculum Vitae'; },
        set() {},
      });
    });
    
    // Also set it directly
    await page.evaluate(() => {
      document.title = 'Bryan Min - Curriculum Vitae';
    });

    const pdf = await page.pdf({ 
      format: 'A4', 
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      },
      // displayHeaderFooter: false,
      // tagged: true,
      // outline: true, // Enable outline/bookmarks based on heading tags
    });
    
    await browser.close();

    // @ts-ignore
    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="cv-bryan-min.pdf"',
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Failed to generate PDF' }), 
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}