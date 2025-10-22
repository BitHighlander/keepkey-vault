import { BaseReportGenerator as IBaseReportGenerator, ReportData, ReportOptions } from './types';

export abstract class BaseReportGenerator implements IBaseReportGenerator {
  protected pdfMake: any;

  constructor() {
    // Dynamic import for pdfmake to avoid SSR issues
    if (typeof window !== 'undefined') {
      this.pdfMake = require('pdfmake/build/pdfmake');
      const pdfFonts = require('pdfmake/build/vfs_fonts');
      this.pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;
    }
  }

  abstract generateReport(assetContext: any, app: any, options: ReportOptions): Promise<ReportData>;
  abstract isSupported(assetContext: any): boolean;
  abstract getDefaultOptions(): ReportOptions;

  protected getCurrentDate(): string {
    return new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  protected formatBalance(balance: string | number, decimals: number = 8): string {
    const numBalance = typeof balance === 'string' ? parseFloat(balance) : balance;
    return numBalance.toFixed(decimals);
  }

  public async generatePDF(reportData: ReportData): Promise<void> {
    if (!this.pdfMake) {
      console.error('pdfMake not loaded');
      return;
    }

    const docDefinition = this.createPDFDefinition(reportData);
    const filename = `${reportData.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    this.pdfMake.createPdf(docDefinition).download(filename);
  }

  protected createPDFDefinition(reportData: ReportData): any {
    const content: any[] = [
      {
        text: reportData.title,
        style: 'header',
        alignment: 'center',
        margin: [0, 0, 0, 10]
      },
      {
        text: reportData.subtitle,
        style: 'subheader',
        alignment: 'center',
        margin: [0, 0, 0, 20]
      },
      {
        text: `Generated on ${reportData.generatedDate}`,
        style: 'date',
        alignment: 'center',
        margin: [0, 0, 0, 20]
      }
    ];

    // Check if we have address flow analysis
    const addressFlowAnalysis = (reportData.sections as any).addressFlowAnalysis;

    // Add sections
    for (const section of reportData.sections) {
      // Add address flow summary boxes if this is the address flow analysis section
      if (section.title === 'Address Flow Analysis' && addressFlowAnalysis) {
        content.push({
          text: section.title,
          style: 'sectionHeader',
          margin: [0, 20, 0, 10]
        });

        // Add summary boxes
        content.push(this.createAddressFlowSummary(addressFlowAnalysis));

        // Add "Addresses We Sent TO" table
        content.push({
          text: 'Addresses We Sent BTC TO',
          style: 'sectionHeader',
          color: '#E74C3C',
          margin: [0, 20, 0, 10]
        });
        content.push(this.createAddressFlowTable(
          addressFlowAnalysis.sentTo,
          'sent',
          'BTC'
        ));

        // Add "Addresses That Sent TO Us" table
        content.push({
          text: 'Addresses That Sent BTC TO Us',
          style: 'sectionHeader',
          color: '#27AE60',
          margin: [0, 20, 0, 10],
          pageBreak: addressFlowAnalysis.sentTo.length > 10 ? 'before' : undefined
        });
        content.push(this.createAddressFlowTable(
          addressFlowAnalysis.receivedFrom,
          'received',
          'BTC'
        ));
      } else {
        // Regular section
        content.push({
          text: section.title,
          style: 'sectionHeader',
          margin: [0, 20, 0, 10]
        });

        switch (section.type) {
          case 'table':
            content.push(this.createTable(section.data));
            break;
          case 'summary':
            content.push(this.createSummary(section.data));
            break;
          case 'list':
            content.push(this.createList(section.data));
            break;
          case 'text':
            content.push({
              text: section.data,
              style: 'body',
              margin: [0, 0, 0, 10]
            });
            break;
        }
      }
    }

    return {
      pageSize: 'LETTER',
      pageOrientation: 'landscape',
      pageMargins: [40, 60, 40, 60],
      content,
      styles: this.getPDFStyles(),
      footer: this.createFooter()
    };
  }

  protected createTable(data: any): any {
    return {
      table: {
        headerRows: 1,
        widths: data.widths || Array(data.headers.length).fill('*'),
        body: [
          data.headers.map((header: string) => ({ text: header, style: 'tableHeader' })),
          ...data.rows
        ]
      },
      layout: {
        fillColor: function (rowIndex: number) {
          return (rowIndex % 2 === 0) ? '#f0f0f0' : null;
        }
      }
    };
  }

  protected createSummary(data: any[]): any {
    return {
      ul: data,
      style: 'summary'
    };
  }

  protected createList(data: any[]): any {
    return {
      ul: data,
      style: 'list'
    };
  }

  protected getPDFStyles(): any {
    return {
      header: {
        fontSize: 22,
        bold: true,
        color: '#333333'
      },
      subheader: {
        fontSize: 16,
        bold: true,
        color: '#666666'
      },
      date: {
        fontSize: 12,
        color: '#999999'
      },
      sectionHeader: {
        fontSize: 16,
        bold: true,
        color: '#333333'
      },
      tableHeader: {
        bold: true,
        fontSize: 10,
        color: '#000000',
        fillColor: '#FFD700'
      },
      body: {
        fontSize: 11,
        color: '#333333'
      },
      summary: {
        fontSize: 11,
        margin: [20, 0, 0, 0]
      },
      list: {
        fontSize: 10,
        margin: [20, 0, 0, 0]
      },
      notes: {
        fontSize: 10,
        italics: true,
        color: '#666666',
        margin: [20, 0, 0, 0]
      },
      addressFlowHeader: {
        fontSize: 12,
        bold: true
      },
      addressFlowAmount: {
        fontSize: 20,
        bold: true,
        color: '#2C3E50'
      },
      addressFlowSubtext: {
        fontSize: 9,
        color: '#7F8C8D'
      }
    };
  }

  protected createFooter(): any {
    return function(currentPage: number, pageCount: number) {
      return {
        text: `Page ${currentPage} of ${pageCount}`,
        alignment: 'center',
        fontSize: 9,
        color: '#999999',
        margin: [0, 30, 0, 0]
      };
    };
  }

  /**
   * Create address flow summary boxes
   * Shows sent/received totals with color coding
   */
  protected createAddressFlowSummary(analysis: any): any {
    return {
      columns: [
        {
          width: '48%',
          stack: [
            {
              text: 'BTC SENT TO EXTERNAL',
              style: 'addressFlowHeader',
              alignment: 'center',
              color: '#E74C3C',
              margin: [0, 10, 0, 5]
            },
            {
              text: `${analysis.totalSentTo.toFixed(8)} BTC`,
              style: 'addressFlowAmount',
              alignment: 'center',
              margin: [0, 0, 0, 5]
            },
            {
              text: `${analysis.uniqueSentToCount} unique addresses`,
              style: 'addressFlowSubtext',
              alignment: 'center',
              margin: [0, 0, 0, 10]
            }
          ],
          fillColor: '#FFF5F5',
          margin: [0, 0, 10, 0]
        },
        {
          width: '48%',
          stack: [
            {
              text: 'BTC RECEIVED FROM EXTERNAL',
              style: 'addressFlowHeader',
              alignment: 'center',
              color: '#27AE60',
              margin: [0, 10, 0, 5]
            },
            {
              text: `${analysis.totalReceivedFrom.toFixed(8)} BTC`,
              style: 'addressFlowAmount',
              alignment: 'center',
              margin: [0, 0, 0, 5]
            },
            {
              text: `${analysis.uniqueReceivedFromCount} unique addresses`,
              style: 'addressFlowSubtext',
              alignment: 'center',
              margin: [0, 0, 0, 10]
            }
          ],
          fillColor: '#F0FFF4',
          margin: [10, 0, 0, 0]
        }
      ],
      margin: [0, 10, 0, 20]
    };
  }

  /**
   * Create address flow table
   * Shows addresses sorted by amount
   */
  protected createAddressFlowTable(
    addresses: any[],
    type: 'sent' | 'received',
    symbol: string = 'BTC'
  ): any {
    if (addresses.length === 0) {
      return {
        text: 'No external addresses found',
        style: 'body',
        italics: true,
        color: '#999999',
        margin: [0, 10, 0, 10]
      };
    }

    const headerColor = type === 'sent' ? '#E74C3C' : '#27AE60';

    return {
      table: {
        headerRows: 1,
        widths: [30, '*', 80, 50, 60],
        body: [
          [
            { text: '#', style: 'tableHeader', alignment: 'center' },
            { text: 'Address', style: 'tableHeader' },
            { text: `Amount (${symbol})`, style: 'tableHeader', alignment: 'right' },
            { text: 'TX Count', style: 'tableHeader', alignment: 'center' },
            { text: 'Type', style: 'tableHeader', alignment: 'center' }
          ],
          ...addresses.map((addr, idx) => [
            { text: (idx + 1).toString(), alignment: 'center', fontSize: 8 },
            { text: addr.address, fontSize: 7, noWrap: false },
            { text: addr.amount.toFixed(8), alignment: 'right', fontSize: 8 },
            { text: addr.txCount.toString(), alignment: 'center', fontSize: 8 },
            { text: 'External', alignment: 'center', fontSize: 8, color: headerColor }
          ])
        ]
      },
      layout: {
        fillColor: function (rowIndex: number) {
          return rowIndex === 0 ? null : (rowIndex % 2 === 0) ? '#f9f9f9' : null;
        },
        hLineWidth: function (i: number, node: any) {
          return i === 0 || i === 1 || i === node.table.body.length ? 0.5 : 0.3;
        },
        vLineWidth: function () {
          return 0.3;
        },
        hLineColor: function () {
          return '#BDC3C7';
        },
        vLineColor: function () {
          return '#BDC3C7';
        }
      },
      margin: [0, 10, 0, 10]
    };
  }
}