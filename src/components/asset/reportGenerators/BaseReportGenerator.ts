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

    // Add sections
    for (const section of reportData.sections) {
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
}