import csv
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm


def csv_response(header, rows, filename):
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    writer = csv.writer(response)
    writer.writerow(header)
    writer.writerows(rows)
    return response


def pdf_response(title, header, rows, filename, col_widths=None):
    """
    col_widths: optional list of widths (reportlab units, e.g. N * inch) matching
    `header`'s length. Without it, reportlab sizes each column to its content's
    natural unwrapped width, which lets long values (UUIDs, JSON blobs) overflow
    the page frame and get cropped — always pass explicit widths for tables with
    long-text columns.
    """
    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'

    doc = SimpleDocTemplate(
        response,
        pagesize=landscape(letter),
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
    )
    styles = getSampleStyleSheet()
    cell_style = ParagraphStyle('ExportCell', parent=styles['Normal'], fontSize=7, leading=8.5)
    header_style = ParagraphStyle(
        'ExportHeader', parent=cell_style, textColor=colors.white, fontName='Helvetica-Bold',
    )
    elements = [Paragraph(title, styles['Title']), Spacer(1, 0.5 * cm)]

    # Cells are wrapped in Paragraph (not plain strings) so reportlab actually
    # wraps long text within its column instead of letting it overflow the page.
    header_row = [Paragraph(str(cell), header_style) for cell in header]
    body_rows = [
        [Paragraph(str(cell) if cell is not None else '', cell_style) for cell in row]
        for row in rows
    ]
    table = Table([header_row] + body_rows, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2d5dc2')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f2f2f2')]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(table)
    doc.build(elements)
    return response
