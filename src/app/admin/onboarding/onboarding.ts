import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ImportService, ImportResult } from '../../core/services/import.service';

type StepId = 'depots' | 'users' | 'materials' | 'consumables' | 'vehicles' | 'orders';

type StepConfig = {
  id: StepId;
  title: string;
  description: string;
  template: string;
  filename: string;
};

@Component({
  selector: 'app-onboarding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.scss',
})
export class Onboarding {
  private importSvc = inject(ImportService);

  readonly steps: StepConfig[] = [
    {
      id: 'depots',
      title: 'Importer les dépôts',
      description: 'Commence par créer les dépôts. Les autres imports peuvent les référencer par nom.',
      filename: 'depots-template.csv',
      template: [
        'name,city,address,phone',
        'Depot Nord,Lille,12 rue de la Fibre,0320000000'
      ].join('\n')
    },
    {
      id: 'users',
      title: 'Importer les utilisateurs',
      description: 'Ajoute les comptes (gestionnaires, techniciens, admins).',
      filename: 'users-template.csv',
      template: [
        'firstName,lastName,email,phone,role,depot,username,password,authEnabled,mustChangePassword',
        'Ibrahima,COULIBALY,ibrahima@fxn.com,0612345678,TECHNICIEN,Depot Nord,ibrahima,,true,true'
      ].join('\n')
    },
    {
      id: 'materials',
      title: 'Importer les matériels',
      description: 'Charge les matériels et leur stock initial.',
      filename: 'materials-template.csv',
      template: [
        'name,category,description,quantity,depot',
        'Perceuse,Outillage,Perceuse sans fil,12,Depot Nord'
      ].join('\n')
    },
    {
      id: 'consumables',
      title: 'Importer les consommables',
      description: 'Charge les consommables et leur stock initial.',
      filename: 'consumables-template.csv',
      template: [
        'name,unit,quantity,minQuantity,depot',
        'Touret 500,m,4,0,Depot Nord'
      ].join('\n')
    },
    {
      id: 'vehicles',
      title: 'Importer les véhicules',
      description: 'Ajoute la flotte et, si besoin, assigne un technicien.',
      filename: 'vehicles-template.csv',
      template: [
        'plateNumber,brand,model,year,state,depot,assignedTo',
        'AA-123-BB,Renault,Kangoo,2021,Disponible,Depot Nord,tech@fxn.com'
      ].join('\n')
    },
    {
      id: 'orders',
      title: 'Importer les commandes',
      description: 'Charge les commandes et leurs lignes (répéter la référence pour plusieurs lignes).',
      filename: 'orders-template.csv',
      template: [
        'reference,client,date,status,amount,notes,resourceType,resourceName,quantity,unitPrice',
        'CMD-1001,Client A,2024-01-15,VALIDEE,0,Commande test,MATERIAL,Perceuse,2,45',
        'CMD-1001,Client A,2024-01-15,VALIDEE,0,Commande test,CONSUMABLE,Touret 500,4,3.5'
      ].join('\n')
    }
  ];

  readonly activeStep = signal<StepId>('depots');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<ImportResult | null>(null);

  readonly activeConfig = computed(() => this.steps.find(s => s.id === this.activeStep()));

  setStep(id: StepId): void {
    this.activeStep.set(id);
    this.error.set(null);
    this.result.set(null);
  }

  downloadTemplate(): void {
    const cfg = this.activeConfig();
    if (!cfg) return;

    const blob = new Blob([cfg.template], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cfg.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      this.uploadCsv(text);
      if (input) input.value = '';
    };
    reader.onerror = () => {
      this.error.set('Impossible de lire le fichier CSV.');
    };
    reader.readAsText(file);
  }

  private uploadCsv(csv: string): void {
    const step = this.activeStep();
    this.loading.set(true);
    this.error.set(null);
    this.result.set(null);

    const req =
      step === 'depots' ? this.importSvc.importDepots(csv)
        : step === 'users' ? this.importSvc.importUsers(csv)
          : step === 'materials' ? this.importSvc.importMaterials(csv)
            : step === 'consumables' ? this.importSvc.importConsumables(csv)
              : step === 'vehicles' ? this.importSvc.importVehicles(csv)
                : this.importSvc.importOrders(csv);

    req.subscribe({
      next: (res) => {
        this.result.set(res.data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Erreur import CSV');
      }
    });
  }
}
