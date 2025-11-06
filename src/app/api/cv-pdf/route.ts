import puppeteer from 'puppeteer';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
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

    const pdf = await page.pdf({ 
      format: 'A4', 
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });
    
    await browser.close();

    // @ts-ignore
    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="bryan_min_cv.pdf"',
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