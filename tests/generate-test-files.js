/**
 * Test File Generator for CSV Edge Cases
 *
 * Generates a comprehensive suite of test files covering all edge cases
 * for bulletproof file loading.
 *
 * Run: node tests/generate-test-files.js
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'csv-edge-cases');

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Helper to write file with specific encoding/format
function writeTestFile(filename, content, encoding = 'utf8') {
  const filepath = join(OUTPUT_DIR, filename);
  if (encoding === 'utf8') {
    writeFileSync(filepath, content, 'utf8');
  } else if (encoding === 'utf8-bom') {
    writeFileSync(filepath, '\ufeff' + content, 'utf8');
  } else if (encoding === 'utf16le') {
    const buffer = Buffer.from('\ufeff' + content, 'utf16le');
    writeFileSync(filepath, buffer);
  } else if (encoding === 'utf16be') {
    // UTF-16 BE with BOM
    const utf16le = Buffer.from('\ufeff' + content, 'utf16le');
    const utf16be = Buffer.alloc(utf16le.length);
    for (let i = 0; i < utf16le.length; i += 2) {
      utf16be[i] = utf16le[i + 1];
      utf16be[i + 1] = utf16le[i];
    }
    writeFileSync(filepath, utf16be);
  } else if (encoding === 'latin1') {
    writeFileSync(filepath, content, 'latin1');
  } else if (encoding === 'binary') {
    writeFileSync(filepath, content, 'binary');
  } else {
    writeFileSync(filepath, content, encoding);
  }
  console.log(`Generated: ${filename}`);
  return filepath;
}

// Helper to convert to CRLF line endings
function toCRLF(content) {
  return content.replace(/\n/g, '\r\n');
}

// Helper to convert to CR-only line endings (old Mac)
function toCR(content) {
  return content.replace(/\n/g, '\r');
}

const tests = [];

// =============================================================================
// 1. ENCODING TESTS
// =============================================================================

// 1.1 Standard UTF-8 (baseline)
tests.push({
  name: '01-encoding-utf8.csv',
  content: `name,city,country
Alice,München,Germany
Bob,São Paulo,Brazil
Charlie,東京,Japan
Diana,Москва,Russia`,
  encoding: 'utf8',
  category: 'encoding',
  expectedRows: 4
});

// 1.2 UTF-8 with BOM
tests.push({
  name: '01-encoding-utf8-bom.csv',
  content: `name,city,country
Alice,München,Germany
Bob,São Paulo,Brazil`,
  encoding: 'utf8-bom',
  category: 'encoding',
  expectedRows: 2
});

// 1.3 UTF-16 LE (SQL Server style)
tests.push({
  name: '01-encoding-utf16le.csv',
  content: `name,city,country
Alice,New York,USA
Bob,London,UK`,
  encoding: 'utf16le',
  category: 'encoding',
  expectedRows: 2
});

// 1.4 UTF-16 BE
tests.push({
  name: '01-encoding-utf16be.csv',
  content: `name,city,country
Alice,Paris,France
Bob,Berlin,Germany`,
  encoding: 'utf16be',
  category: 'encoding',
  expectedRows: 2
});

// 1.5 Windows-1252 / Latin1 (European characters)
tests.push({
  name: '01-encoding-latin1.csv',
  content: `name,price,currency
Café,€25.00,EUR
Naïve,£10.50,GBP
Résumé,¥1000,JPY`,
  encoding: 'latin1',
  category: 'encoding',
  expectedRows: 3
});

// =============================================================================
// 2. LINE ENDING TESTS
// =============================================================================

// 2.1 Windows CRLF
tests.push({
  name: '02-lineending-crlf.csv',
  content: toCRLF(`id,name,value
1,Alice,100
2,Bob,200
3,Charlie,300`),
  encoding: 'utf8',
  category: 'line-endings',
  expectedRows: 3
});

// 2.2 Old Mac CR only
tests.push({
  name: '02-lineending-cr.csv',
  content: toCR(`id,name,value
1,Alice,100
2,Bob,200
3,Charlie,300`),
  encoding: 'utf8',
  category: 'line-endings',
  expectedRows: 3
});

// 2.3 Mixed line endings (corrupt file)
tests.push({
  name: '02-lineending-mixed.csv',
  content: `id,name,value\r\n1,Alice,100\n2,Bob,200\r3,Charlie,300\r\n`,
  encoding: 'utf8',
  category: 'line-endings',
  expectedRows: 3
});

// =============================================================================
// 3. DELIMITER TESTS
// =============================================================================

// 3.1 Tab-delimited (TSV)
tests.push({
  name: '03-delimiter-tab.tsv',
  content: `name\tage\tcity
Alice\t30\tNew York
Bob\t25\tLondon
Charlie\t35\tTokyo`,
  encoding: 'utf8',
  category: 'delimiter',
  expectedRows: 3
});

// 3.2 Semicolon-delimited (European Excel)
tests.push({
  name: '03-delimiter-semicolon.csv',
  content: `name;price;quantity
Apple;1,50;10
Banana;0,75;25
Orange;2,00;15`,
  encoding: 'utf8',
  category: 'delimiter',
  expectedRows: 3
});

// 3.3 Pipe-delimited
tests.push({
  name: '03-delimiter-pipe.csv',
  content: `id|name|department|salary
1|Alice|Engineering|75000
2|Bob|Marketing|65000
3|Charlie|Sales|70000`,
  encoding: 'utf8',
  category: 'delimiter',
  expectedRows: 3
});

// =============================================================================
// 4. QUOTING & ESCAPING TESTS
// =============================================================================

// 4.1 Embedded commas in quoted fields
tests.push({
  name: '04-quote-embedded-comma.csv',
  content: `name,address,city
Alice,"123 Main St, Apt 4",New York
Bob,"456 Oak Ave, Suite 100",Chicago
Charlie,789 Pine Rd,Boston`,
  encoding: 'utf8',
  category: 'quoting',
  expectedRows: 3
});

// 4.2 Embedded quotes (escaped with "")
tests.push({
  name: '04-quote-embedded-quotes.csv',
  content: `name,description,price
Widget,"The ""best"" widget ever",19.99
Gadget,"Say ""Hello World""",29.99
Tool,"Standard 2"" size",9.99`,
  encoding: 'utf8',
  category: 'quoting',
  expectedRows: 3
});

// 4.3 Embedded newlines in quoted fields
tests.push({
  name: '04-quote-embedded-newline.csv',
  content: `name,address,notes
Alice,"123 Main St
Apt 4",Good customer
Bob,"456 Oak Ave
Suite 100
Building B",VIP
Charlie,789 Pine Rd,Standard`,
  encoding: 'utf8',
  category: 'quoting',
  expectedRows: 3
});

// 4.4 Smart quotes (curly quotes from Word)
tests.push({
  name: '04-quote-smart-quotes.csv',
  content: `name,quote,author
Book1,"It\u2019s a \u201cgreat\u201d book",John
Book2,\u201cHello World\u201d,Jane
Book3,'Single quotes',Bob`,
  encoding: 'utf8',
  category: 'quoting',
  expectedRows: 3
});

// 4.5 Unbalanced quotes (malformed)
tests.push({
  name: '04-quote-unbalanced.csv',
  content: `name,description,value
Item1,"This is fine",100
Item2,"Missing end quote,200
Item3,No quotes needed,300`,
  encoding: 'utf8',
  category: 'quoting',
  expectedRows: 3,
  expectWarning: true
});

// =============================================================================
// 5. HEADER TESTS
// =============================================================================

// 5.1 Spaces in column names
tests.push({
  name: '05-header-spaces.csv',
  content: `First Name,Last Name,Email Address,Phone Number
Alice,Smith,alice@example.com,555-1234
Bob,Jones,bob@example.com,555-5678`,
  encoding: 'utf8',
  category: 'headers',
  expectedRows: 2
});

// 5.2 Special characters in column names
tests.push({
  name: '05-header-special-chars.csv',
  content: `ID#,User@Name,Price($),% Complete,Status!
1,alice,100.00,75%,Active
2,bob,200.00,50%,Pending`,
  encoding: 'utf8',
  category: 'headers',
  expectedRows: 2
});

// 5.3 Duplicate column names
tests.push({
  name: '05-header-duplicates.csv',
  content: `name,value,name,value,extra
Alice,100,Smith,200,notes1
Bob,150,Jones,250,notes2`,
  encoding: 'utf8',
  category: 'headers',
  expectedRows: 2
});

// 5.4 Empty column names
tests.push({
  name: '05-header-empty.csv',
  content: `name,,value,,notes
Alice,A,100,X,Good
Bob,B,200,Y,OK`,
  encoding: 'utf8',
  category: 'headers',
  expectedRows: 2
});

// 5.5 Column names starting with numbers
tests.push({
  name: '05-header-numeric.csv',
  content: `1st_quarter,2nd_quarter,3rd_quarter,4th_quarter
100,150,200,175
110,160,210,180`,
  encoding: 'utf8',
  category: 'headers',
  expectedRows: 2
});

// 5.6 SQL reserved words as column names
tests.push({
  name: '05-header-reserved.csv',
  content: `select,from,where,table,order
1,A,X,T1,1
2,B,Y,T2,2`,
  encoding: 'utf8',
  category: 'headers',
  expectedRows: 2
});

// 5.7 Very long column names
tests.push({
  name: '05-header-long.csv',
  content: `this_is_a_very_long_column_name_that_exceeds_normal_limits_and_should_be_truncated_properly,short,another_extremely_long_column_name_that_goes_on_and_on
value1,value2,value3
value4,value5,value6`,
  encoding: 'utf8',
  category: 'headers',
  expectedRows: 2
});

// 5.8 Newlines in header names
tests.push({
  name: '05-header-newline.csv',
  content: `"First
Name","Last
Name",Email
Alice,Smith,alice@example.com
Bob,Jones,bob@example.com`,
  encoding: 'utf8',
  category: 'headers',
  expectedRows: 2
});

// =============================================================================
// 6. STRUCTURAL TESTS
// =============================================================================

// 6.1 Empty file
tests.push({
  name: '06-structure-empty.csv',
  content: '',
  encoding: 'utf8',
  category: 'structure',
  expectedRows: 0,
  expectError: true
});

// 6.2 Headers only, no data
tests.push({
  name: '06-structure-headers-only.csv',
  content: `id,name,value`,
  encoding: 'utf8',
  category: 'structure',
  expectedRows: 0
});

// 6.3 Single column
tests.push({
  name: '06-structure-single-column.csv',
  content: `names
Alice
Bob
Charlie
Diana`,
  encoding: 'utf8',
  category: 'structure',
  expectedRows: 4
});

// 6.4 Single row (plus header)
tests.push({
  name: '06-structure-single-row.csv',
  content: `id,name,value
1,Alice,100`,
  encoding: 'utf8',
  category: 'structure',
  expectedRows: 1
});

// 6.5 Ragged rows (inconsistent column count)
tests.push({
  name: '06-structure-ragged.csv',
  content: `id,name,value,extra
1,Alice,100
2,Bob,200,bonus
3,Charlie,300,bonus,surprise
4,Diana`,
  encoding: 'utf8',
  category: 'structure',
  expectedRows: 4
});

// 6.6 Blank rows interspersed
tests.push({
  name: '06-structure-blank-rows.csv',
  content: `id,name,value
1,Alice,100

2,Bob,200

3,Charlie,300`,
  encoding: 'utf8',
  category: 'structure',
  expectedRows: 3,
  note: 'DuckDB may count blank rows'
});

// 6.7 Trailing blank rows
tests.push({
  name: '06-structure-trailing-blank.csv',
  content: `id,name,value
1,Alice,100
2,Bob,200
3,Charlie,300



`,
  encoding: 'utf8',
  category: 'structure',
  expectedRows: 3
});

// 6.8 Header not on line 1 (metadata above)
tests.push({
  name: '06-structure-metadata-header.csv',
  content: `Report: Monthly Sales
Generated: 2024-01-15
,,,
id,name,value
1,Alice,100
2,Bob,200`,
  encoding: 'utf8',
  category: 'structure',
  expectedRows: 2,
  skipRows: 3,
  note: 'Requires skipRows=3'
});

// =============================================================================
// 7. DATA TYPE TESTS
// =============================================================================

// 7.1 Various date formats
tests.push({
  name: '07-datatype-dates.csv',
  content: `id,us_date,eu_date,iso_date,verbose_date
1,01/15/2024,15/01/2024,2024-01-15,January 15 2024
2,12/31/2023,31/12/2023,2023-12-31,December 31 2023
3,06/05/2024,05/06/2024,2024-06-05,June 5 2024`,
  encoding: 'utf8',
  category: 'datatypes',
  expectedRows: 3
});

// 7.2 Excel serial dates
tests.push({
  name: '07-datatype-excel-dates.csv',
  content: `id,date_serial,expected
1,44927,2023-01-01
2,45292,2024-01-01
3,45658,2025-01-01`,
  encoding: 'utf8',
  category: 'datatypes',
  expectedRows: 3
});

// 7.3 Currency formats
tests.push({
  name: '07-datatype-currency.csv',
  content: `item,price_us,price_eu,price_uk
Widget,$19.99,€18.50,£16.00
Gadget,$29.99,€27.75,£24.00
Tool,"$1,299.00","€1.199,00","£1,100.00"`,
  encoding: 'utf8',
  category: 'datatypes',
  expectedRows: 3
});

// 7.4 Percentage formats
tests.push({
  name: '07-datatype-percentages.csv',
  content: `metric,as_percent,as_decimal,as_fraction
Growth,25%,0.25,1/4
Margin,33.33%,0.3333,1/3
Rate,150%,1.50,3/2`,
  encoding: 'utf8',
  category: 'datatypes',
  expectedRows: 3
});

// 7.5 Thousands separators
tests.push({
  name: '07-datatype-thousands.csv',
  content: `country,population_us,population_eu
USA,"331,000,000","331.000.000"
Brazil,"214,000,000","214.000.000"
Japan,"125,800,000","125.800.000"`,
  encoding: 'utf8',
  category: 'datatypes',
  expectedRows: 3
});

// 7.6 Scientific notation
tests.push({
  name: '07-datatype-scientific.csv',
  content: `measurement,value_sci,value_full
Distance,1.5E+11,150000000000
Mass,9.1E-31,0.00000000000000000000000000000091
Speed,3E+8,300000000`,
  encoding: 'utf8',
  category: 'datatypes',
  expectedRows: 3
});

// 7.7 Leading zeros (ZIP codes, phone numbers)
tests.push({
  name: '07-datatype-leading-zeros.csv',
  content: `name,zip,phone,account_number
Alice,01234,0123456789,000001234
Bob,07890,0987654321,000005678
Charlie,00501,0111222333,000000001`,
  encoding: 'utf8',
  category: 'datatypes',
  expectedRows: 3
});

// 7.8 Negative numbers in parentheses
tests.push({
  name: '07-datatype-negative-parens.csv',
  content: `account,balance,change
Checking,1500.00,(250.00)
Savings,5000.00,500.00
Credit,(2500.00),(100.00)`,
  encoding: 'utf8',
  category: 'datatypes',
  expectedRows: 3
});

// 7.9 Boolean variations
tests.push({
  name: '07-datatype-booleans.csv',
  content: `id,bool_yn,bool_tf,bool_10,bool_yesno
1,Y,TRUE,1,Yes
2,N,FALSE,0,No
3,Y,True,1,YES
4,N,False,0,NO`,
  encoding: 'utf8',
  category: 'datatypes',
  expectedRows: 4
});

// 7.10 NULL representations
tests.push({
  name: '07-datatype-nulls.csv',
  content: `id,null_empty,null_word,null_na,null_dash,null_excel
1,,NULL,N/A,-,#N/A
2,,null,NA,--,#VALUE!
3,, ,n/a,,#REF!`,
  encoding: 'utf8',
  category: 'datatypes',
  expectedRows: 3
});

// =============================================================================
// 8. CHARACTER TESTS
// =============================================================================

// 8.1 Emoji in data
tests.push({
  name: '08-chars-emoji.csv',
  content: `name,status,reaction
Alice,Active 🟢,👍
Bob,Pending ⏳,🤔
Charlie,Complete ✅,🎉`,
  encoding: 'utf8',
  category: 'characters',
  expectedRows: 3
});

// 8.2 Unicode special characters
tests.push({
  name: '08-chars-unicode-special.csv',
  content: `id,text_with_special
1,Zero\u200Bwidth\u200Bspace
2,Non\u00A0breaking\u00A0space
3,En–dash—Em—dash
4,Ellipsis…here`,
  encoding: 'utf8',
  category: 'characters',
  expectedRows: 4
});

// 8.3 RTL text (Arabic/Hebrew)
tests.push({
  name: '08-chars-rtl.csv',
  content: `id,english,arabic,hebrew
1,Hello,مرحبا,שלום
2,World,عالم,עולם
3,Test,اختبار,מבחן`,
  encoding: 'utf8',
  category: 'characters',
  expectedRows: 3
});

// 8.4 Control characters
tests.push({
  name: '08-chars-control.csv',
  content: `id,name,value
1,Tab\there,100
2,Normal,200
3,Form\x0Cfeed,300`,
  encoding: 'utf8',
  category: 'characters',
  expectedRows: 3
});

// 8.5 Null bytes (should be removed)
tests.push({
  name: '08-chars-null-bytes.csv',
  content: `id,name,value
1,Al\x00ice,100
2,Bo\x00b,200
3,Charlie,300`,
  encoding: 'utf8',
  category: 'characters',
  expectedRows: 3
});

// =============================================================================
// 9. EXCEL-SPECIFIC TESTS
// =============================================================================

// 9.1 Formula text
tests.push({
  name: '09-excel-formulas.csv',
  content: `item,quantity,price,total
Widget,10,5.00,=B2*C2
Gadget,5,10.00,=B3*C3
TOTAL,=SUM(B2:B3),,=SUM(D2:D3)`,
  encoding: 'utf8',
  category: 'excel',
  expectedRows: 3
});

// 9.2 Excel error values
tests.push({
  name: '09-excel-errors.csv',
  content: `formula,result
=1/0,#DIV/0!
=UNKNOWN(),#NAME?
=A1+BadRef,#REF!
=VALUE("text"),#VALUE!
Missing,#N/A`,
  encoding: 'utf8',
  category: 'excel',
  expectedRows: 5
});

// =============================================================================
// 10. SIZE TESTS
// =============================================================================

// 10.1 Wide file (100+ columns)
const wideHeaders = Array.from({length: 120}, (_, i) => `col_${i+1}`).join(',');
const wideRow = Array.from({length: 120}, (_, i) => `val_${i+1}`).join(',');
tests.push({
  name: '10-size-wide.csv',
  content: `${wideHeaders}
${wideRow}
${wideRow}
${wideRow}`,
  encoding: 'utf8',
  category: 'size',
  expectedRows: 3
});

// 10.2 Large cells (1KB each)
const largeCell = 'Lorem ipsum dolor sit amet, '.repeat(40);
tests.push({
  name: '10-size-large-cells.csv',
  content: `id,description,notes
1,"${largeCell}","${largeCell}"
2,"${largeCell}","${largeCell}"`,
  encoding: 'utf8',
  category: 'size',
  expectedRows: 2
});

// 10.3 Many rows (10K) - smaller version for quick testing
const manyRowsContent = ['id,name,value'];
for (let i = 1; i <= 10000; i++) {
  manyRowsContent.push(`${i},name_${i},${i * 10}`);
}
tests.push({
  name: '10-size-10k-rows.csv',
  content: manyRowsContent.join('\n'),
  encoding: 'utf8',
  category: 'size',
  expectedRows: 10000
});

// =============================================================================
// 11. COMBINED EDGE CASES
// =============================================================================

// 11.1 European CSV with CRLF (common Windows Excel export)
tests.push({
  name: '11-combo-european-excel.csv',
  content: toCRLF(`product;price;quantity;total
"Widget, Standard";19,99;10;199,90
"Gadget ""Pro""";29,99;5;149,95
Tool;9,99;20;199,80`),
  encoding: 'utf8-bom',
  category: 'combined',
  expectedRows: 3
});

// 11.2 Full Unicode test with various issues
tests.push({
  name: '11-combo-full-unicode.csv',
  content: toCRLF(`name,city,description,price
"Müller, Hans",München,"German ""ä, ö, ü""",€29,99
"田中 太郎",東京,"Japanese 日本語",¥3000
"Иванов, Иван",Москва,"Russian Русский",₽2500
"محمد علي",القاهرة,"Arabic العربية",E£500`),
  encoding: 'utf8-bom',
  category: 'combined',
  expectedRows: 4
});

// =============================================================================
// GENERATE ALL FILES
// =============================================================================

console.log('\n========================================');
console.log('CSV Edge Case Test File Generator');
console.log('========================================\n');

// Generate test manifest
const manifest = {
  generated: new Date().toISOString(),
  outputDir: OUTPUT_DIR,
  tests: []
};

for (const test of tests) {
  writeTestFile(test.name, test.content, test.encoding);
  manifest.tests.push({
    name: test.name,
    category: test.category,
    encoding: test.encoding,
    expectedRows: test.expectedRows,
    skipRows: test.skipRows || 0,
    expectError: test.expectError || false,
    expectWarning: test.expectWarning || false,
    note: test.note || null
  });
}

// Write manifest
writeFileSync(
  join(OUTPUT_DIR, '_manifest.json'),
  JSON.stringify(manifest, null, 2),
  'utf8'
);
console.log('\nGenerated: _manifest.json');

// Summary
const categories = {};
for (const test of tests) {
  categories[test.category] = (categories[test.category] || 0) + 1;
}

console.log('\n========================================');
console.log('Summary');
console.log('========================================');
console.log(`Total test files: ${tests.length}`);
console.log('\nBy category:');
for (const [cat, count] of Object.entries(categories).sort()) {
  console.log(`  ${cat}: ${count}`);
}
console.log('\nFiles written to:', OUTPUT_DIR);
console.log('');
