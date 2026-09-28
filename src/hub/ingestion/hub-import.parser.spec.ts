import { HubImportParseError, parseHubImport } from './hub-import.parser';

const validRow = {
  sourceRecordId: 'CM-HUM-001',
  observedAt: '2026-09-20T08:30:00Z',
  countryCode: 'CM',
  sector: 'human',
  category: 'Syndrome fébrile',
  title: 'Hausse simulée',
  summary: 'Agrégat fictif sans donnée nominative.',
  adminArea: 'Centre',
  longitude: 11.52,
  latitude: 3.87,
  severity: 'medium',
};

describe('parseHubImport', () => {
  it('normalise un tableau JSON canonique sans créer de signal', () => {
    const result = parseHubImport({
      content: JSON.stringify([validRow]),
      format: 'JSON',
      sourceSystem: 'DHIS2',
      sourceInstance: 'sandbox-minsante',
      countryCode: 'CM',
      mapping: [],
    });

    expect(result.totalRecords).toBe(1);
    expect(result.issues).toEqual([]);
    expect(result.candidates[0]).toMatchObject({
      sourceRecordId: 'CM-HUM-001',
      sector: 'human',
      countryCode: 'CM',
      severity: 'medium',
    });
    expect(result.candidates[0].canonicalId).toMatch(/^IMP-CM-[A-F0-9]{20}$/);
  });

  it('applique un mapping de colonnes CSV en liste blanche', () => {
    const csv = [
      'record,date,pays,domaine,categorie,titre,resume,zone,lng,lat,niveau',
      'CM-2,2026-09-20T08:30:00Z,CM,human,Test,Titre,Résumé,Est,14.1,4.2,low',
    ].join('\n');
    const fields = [
      'sourceRecordId',
      'observedAt',
      'countryCode',
      'sector',
      'category',
      'title',
      'summary',
      'adminArea',
      'longitude',
      'latitude',
      'severity',
    ] as const;
    const sources = [
      'record',
      'date',
      'pays',
      'domaine',
      'categorie',
      'titre',
      'resume',
      'zone',
      'lng',
      'lat',
      'niveau',
    ];
    const result = parseHubImport({
      content: csv,
      format: 'CSV',
      sourceSystem: 'DHIS2',
      sourceInstance: 'sandbox',
      countryCode: 'CM',
      mapping: fields.map((targetField, index) => ({
        targetField,
        sourceField: sources[index],
      })),
    });
    expect(result.candidates).toHaveLength(1);
    expect(result.issues).toEqual([]);
  });

  it('met en erreur un secteur incohérent et une gravité absente', () => {
    const result = parseHubImport({
      content: JSON.stringify([
        { ...validRow, sector: 'animal', severity: '' },
      ]),
      format: 'JSON',
      sourceSystem: 'DHIS2',
      sourceInstance: 'sandbox',
      countryCode: 'CM',
      mapping: [],
    });
    expect(result.candidates).toHaveLength(0);
    expect(result.issues.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        'SECTOR_MISMATCH',
        'MISSING_FIELD',
        'INVALID_VALUE',
      ]),
    );
  });

  it('refuse les propriétés dangereuses dans le mapping', () => {
    expect(() =>
      parseHubImport({
        content: JSON.stringify([validRow]),
        format: 'JSON',
        sourceSystem: 'DHIS2',
        sourceInstance: 'sandbox',
        countryCode: 'CM',
        mapping: [{ sourceField: '__proto__', targetField: 'title' }],
      }),
    ).toThrow(HubImportParseError);
  });

  it('lit les coordonnées d’une FeatureCollection GeoJSON', () => {
    const result = parseHubImport({
      content: JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [11.52, 3.87] },
            properties: validRow,
          },
        ],
      }),
      format: 'GEOJSON',
      sourceSystem: 'DHIS2',
      sourceInstance: 'sandbox',
      countryCode: 'CM',
      mapping: [],
    });
    expect(result.candidates[0]).toMatchObject({
      longitude: 11.52,
      latitude: 3.87,
    });
  });
});
