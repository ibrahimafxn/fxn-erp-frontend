import { formatTechnicianPrestationLabel } from './technician-prestation-labels';

describe('formatTechnicianPrestationLabel', () => {
  it('returns the short technician label for known codes', () => {
    expect(formatTechnicianPrestationLabel('RAC_PBO_SOUT', 'Raccordement pavillon (souterrain)')).toBe('Rac Sout');
    expect(formatTechnicianPrestationLabel('FOURREAU_CASSE_PRIVE', 'Fourreau cassé — domaine privé')).toBe('Fourreau F8');
  });

  it('falls back to the provided label when the code is unknown', () => {
    expect(formatTechnicianPrestationLabel('UNKNOWN_CODE', 'Libellé personnalisé')).toBe('Libellé personnalisé');
  });
});
