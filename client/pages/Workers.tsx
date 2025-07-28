import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFirestore } from '@/hooks/useFirestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Users, 
  UserPlus, 
  Search, 
  Edit, 
  Trash2, 
  Filter,
  Download,
  Phone,
  Calendar,
  MapPin,
  AlertCircle
} from 'lucide-react';
import { Worker, Ferme, Room } from '@shared/types';
import * as XLSX from 'xlsx';

export default function Workers() {
  const { user, isSuperAdmin } = useAuth();
  const { data: allWorkers, loading: workersLoading, addDocument, updateDocument, deleteDocument } = useFirestore<Worker>('workers');
  const { data: fermes } = useFirestore<Ferme>('fermes');
  const { data: rooms } = useFirestore<Room>('rooms');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFerme, setSelectedFerme] = useState('all');
  const [selectedGender, setSelectedGender] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    nom: '',
    cin: '',
    telephone: '',
    sexe: 'homme' as 'homme' | 'femme',
    age: 25,
    yearOfBirth: new Date().getFullYear() - 25,
    fermeId: user?.fermeId || '',
    chambre: '',
    dortoir: '',
    statut: 'actif' as 'actif' | 'inactif',
    dateEntree: new Date().toISOString().split('T')[0],
    dateSortie: '',
    motif: 'none'
  });

  // Calculate age from year of birth
  const calculateAge = (yearOfBirth: number): number => {
    const currentYear = new Date().getFullYear();
    return currentYear - yearOfBirth;
  };

  // Debug: Log room data
  React.useEffect(() => {
    console.log('Rooms data:', rooms.map(r => ({
      id: r.id,
      numero: r.numero,
      fermeId: r.fermeId,
      genre: r.genre,
      capaciteTotale: r.capaciteTotale,
      occupantsActuels: r.occupantsActuels
    })));
  }, [rooms]);

  // Check and auto-update worker statuses on component load
  React.useEffect(() => {
    const updateInconsistentStatuses = async () => {
      // Find workers who have exit dates but are still marked as active
      const inconsistentWorkers = allWorkers.filter(worker =>
        worker.dateSortie && worker.statut === 'actif'
      );

      if (inconsistentWorkers.length > 0) {
        console.log(`Found ${inconsistentWorkers.length} workers with exit dates but active status. Auto-updating...`);

        // Update each inconsistent worker
        for (const worker of inconsistentWorkers) {
          try {
            await updateDocument(worker.id, {
              ...worker,
              statut: 'inactif',
              updatedAt: new Date()
            });
            console.log(`Updated worker ${worker.nom} to inactive status`);
          } catch (error) {
            console.error(`Failed to update worker ${worker.nom}:`, error);
          }
        }
      }
    };

    // Only run if we have workers data and user is authenticated
    if (allWorkers.length > 0 && user) {
      updateInconsistentStatuses();
    }
  }, [allWorkers, user, updateDocument]);

  // Filter workers based on user role and filters
  const filteredWorkers = allWorkers.filter(worker => {
    // Role-based filtering
    if (!isSuperAdmin && user?.fermeId) {
      if (worker.fermeId !== user.fermeId) return false;
    }

    // Search filter
    if (searchTerm && !worker.nom.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !worker.cin.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Ferme filter (for superadmin)
    if (selectedFerme !== 'all' && worker.fermeId !== selectedFerme) {
      return false;
    }

    // Gender filter
    if (selectedGender !== 'all' && worker.sexe !== selectedGender) {
      return false;
    }

    return true;
  });

  // Calculate average ages
  const calculateAverageAges = (workers: Worker[]) => {
    const activeWorkers = workers.filter(w => w.statut === 'actif');
    const menWorkers = activeWorkers.filter(w => w.sexe === 'homme');
    const womenWorkers = activeWorkers.filter(w => w.sexe === 'femme');

    const averageAgeMen = menWorkers.length > 0
      ? Math.round(menWorkers.reduce((sum, w) => sum + w.age, 0) / menWorkers.length)
      : 0;

    const averageAgeWomen = womenWorkers.length > 0
      ? Math.round(womenWorkers.reduce((sum, w) => sum + w.age, 0) / womenWorkers.length)
      : 0;

    return { averageAgeMen, averageAgeWomen };
  };

  const { averageAgeMen, averageAgeWomen } = calculateAverageAges(filteredWorkers);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (editingWorker) {
        const updateData = {
          ...formData,
          age: calculateAge(formData.yearOfBirth),
          dateEntree: formData.dateEntree || editingWorker.dateEntree
        };

        // Automatically set status to inactif if exit date is provided
        if (formData.dateSortie) {
          updateData.dateSortie = formData.dateSortie;
          updateData.statut = 'inactif'; // Automatically set to inactive when exit date is added
        } else {
          // If no exit date, ensure status remains actif (unless manually changed)
          updateData.statut = formData.statut || 'actif';
        }

        if (formData.motif && formData.motif !== 'none') {
          updateData.motif = formData.motif;
        }

        await updateDocument(editingWorker.id, updateData);
      } else {
        await addDocument({
          ...formData,
          age: calculateAge(formData.yearOfBirth),
          dateEntree: formData.dateEntree
        });
      }
      
      // Reset form
      setFormData({
        nom: '',
        cin: '',
        telephone: '',
        sexe: 'homme',
        age: 25,
        yearOfBirth: new Date().getFullYear() - 25,
        fermeId: user?.fermeId || '',
        chambre: '',
        dortoir: '',
        statut: 'actif',
        dateEntree: new Date().toISOString().split('T')[0],
        dateSortie: '',
        motif: 'none'
      });
      setEditingWorker(null);
      setIsAddDialogOpen(false);
    } catch (error: any) {
      setError(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (worker: Worker) => {
    setFormData({
      nom: worker.nom,
      cin: worker.cin,
      telephone: worker.telephone,
      sexe: worker.sexe,
      age: worker.age,
      yearOfBirth: worker.yearOfBirth || (new Date().getFullYear() - worker.age),
      fermeId: worker.fermeId,
      chambre: worker.chambre,
      dortoir: worker.dortoir,
      statut: worker.statut,
      dateEntree: worker.dateEntree || new Date().toISOString().split('T')[0],
      dateSortie: worker.dateSortie || '',
      motif: worker.motif || 'none'
    });
    setEditingWorker(worker);
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (workerId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet ouvrier ?')) {
      try {
        await deleteDocument(workerId);
      } catch (error) {
        console.error('Error deleting worker:', error);
      }
    }
  };

  const getStatusBadge = (worker: Worker) => {
    if (worker.statut === 'actif') {
      return <Badge className="bg-green-100 text-green-800">Actif</Badge>;
    } else {
      if (worker.dateSortie) {
        return <Badge className="bg-orange-100 text-orange-800">Sorti</Badge>;
      } else {
        return <Badge variant="secondary">Inactif</Badge>;
      }
    }
  };

  const getGenderBadge = (sexe: string) => {
    return sexe === 'homme' 
      ? <Badge className="bg-blue-100 text-blue-800">Homme</Badge>
      : <Badge className="bg-pink-100 text-pink-800">Femme</Badge>;
  };

  const getFermeName = (fermeId: string) => {
    const ferme = fermes.find(f => f.id === fermeId);
    return ferme?.nom || fermeId;
  };

  // Get available chambers for the selected ferme and gender
  const getAvailableChambres = () => {
    if (!formData.fermeId || !formData.sexe) {
      console.log('getAvailableChambres: Missing fermeId or sexe', { fermeId: formData.fermeId, sexe: formData.sexe });
      return [];
    }

    const filtered = rooms.filter(room => {
      const matchesFerme = room.fermeId === formData.fermeId;
      const matchesGender = (formData.sexe === 'homme' && room.genre === 'hommes') ||
                           (formData.sexe === 'femme' && room.genre === 'femmes');

      return matchesFerme && matchesGender;
    }).sort((a, b) => parseInt(a.numero) - parseInt(b.numero));

    console.log(`getAvailableChambres: Found ${filtered.length} rooms for ferme ${formData.fermeId} and gender ${formData.sexe}`, {
      totalRooms: rooms.length,
      filteredRooms: filtered.map(r => ({ numero: r.numero, genre: r.genre, fermeId: r.fermeId }))
    });

    return filtered;
  };

  const handleExportToExcel = () => {
    // Prepare data for Excel export
    const exportData = filteredWorkers.map(worker => ({
      'Nom': worker.nom,
      'CIN': worker.cin,
      'Téléphone': worker.telephone,
      'Sexe': worker.sexe === 'homme' ? 'Homme' : 'Femme',
      'Âge': worker.age,
      'Année de naissance': worker.yearOfBirth || (new Date().getFullYear() - worker.age),
      'Ferme': getFermeName(worker.fermeId),
      'Chambre': worker.chambre,
      'Dortoir': worker.dortoir,
      'Date d\'entrée': new Date(worker.dateEntree).toLocaleDateString('fr-FR'),
      'Date de sortie': worker.dateSortie ? new Date(worker.dateSortie).toLocaleDateString('fr-FR') : '',
      'Motif de sortie': worker.motif && worker.motif !== 'none' ? worker.motif : '',
      'Statut': worker.statut === 'actif' ? 'Actif' : 'Inactif'
    }));

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Auto-size columns
    const colWidths = [
      { wch: 20 }, // Nom
      { wch: 12 }, // CIN
      { wch: 15 }, // Téléphone
      { wch: 8 },  // Sexe
      { wch: 6 },  // Âge
      { wch: 12 }, // Année de naissance
      { wch: 20 }, // Ferme
      { wch: 10 }, // Chambre
      { wch: 15 }, // Dortoir
      { wch: 12 }, // Date d'entrée
      { wch: 12 }, // Date de sortie
      { wch: 20 }, // Motif
      { wch: 8 }   // Statut
    ];
    worksheet['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ouvriers');

    // Generate filename with current date
    const today = new Date().toISOString().split('T')[0];
    const filename = `ouvriers_${today}.xlsx`;

    // Save file
    XLSX.writeFile(workbook, filename);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center">
            <Users className="mr-2 sm:mr-3 h-6 w-6 sm:h-8 sm:w-8" />
            Gestion des ouvriers
          </h1>
          <p className="text-gray-600 mt-2 text-sm sm:text-base">
            {isSuperAdmin
              ? `${filteredWorkers.length} ouvriers dans toutes les fermes`
              : `${filteredWorkers.length} ouvriers dans votre ferme`
            }
          </p>
          <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
            <span>Âge moyen hommes: <strong className="text-blue-600">{averageAgeMen} ans</strong></span>
            <span>Âge moyen femmes: <strong className="text-pink-600">{averageAgeWomen} ans</strong></span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          <Button variant="outline" onClick={handleExportToExcel}>
            <Download className="mr-2 h-4 w-4" />
            Exporter Excel
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                onClick={() => {
                  setEditingWorker(null);
                  setFormData({
                    nom: '',
                    cin: '',
                    telephone: '',
                    sexe: 'homme',
                    age: 25,
                    yearOfBirth: new Date().getFullYear() - 25,
                    fermeId: user?.fermeId || '',
                    chambre: '',
                    dortoir: '',
                    statut: 'actif',
                    dateEntree: new Date().toISOString().split('T')[0],
                    dateSortie: '',
                    motif: 'none'
                  });
                  setError('');
                }}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Nouvel ouvrier
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto mx-4">
              <DialogHeader>
                <DialogTitle>
                  {editingWorker ? 'Modifier l\'ouvrier' : 'Ajouter un ouvrier'}
                </DialogTitle>
                <DialogDescription>
                  {editingWorker ? 'Modifiez les informations de l\'ouvrier' : 'Remplissez les informations de l\'ouvrier'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nom">Nom complet</Label>
                  <Input 
                    id="nom" 
                    value={formData.nom}
                    onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                    placeholder="Ex: Ahmed Alami" 
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cin">CIN</Label>
                  <Input 
                    id="cin" 
                    value={formData.cin}
                    onChange={(e) => setFormData(prev => ({ ...prev, cin: e.target.value }))}
                    placeholder="Ex: AA123456" 
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telephone">Téléphone</Label>
                  <Input 
                    id="telephone" 
                    value={formData.telephone}
                    onChange={(e) => setFormData(prev => ({ ...prev, telephone: e.target.value }))}
                    placeholder="Ex: 0612345678" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sexe</Label>
                    <Select
                      value={formData.sexe}
                      onValueChange={(value: 'homme' | 'femme') => {
                        console.log(`Gender changed to: ${value}`);
                        setFormData(prev => ({
                          ...prev,
                          sexe: value,
                          chambre: '', // Clear chamber when gender changes
                          dortoir: ''  // Clear dortoir when gender changes
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="homme">Homme</SelectItem>
                        <SelectItem value="femme">Femme</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="yearOfBirth">Année de naissance</Label>
                    <Input
                      id="yearOfBirth"
                      type="number"
                      value={formData.yearOfBirth}
                      onChange={(e) => {
                        const year = parseInt(e.target.value) || new Date().getFullYear();
                        const age = calculateAge(year);
                        setFormData(prev => ({
                          ...prev,
                          yearOfBirth: year,
                          age: age
                        }));
                      }}
                      placeholder={`${new Date().getFullYear() - 25}`}
                      min="1950"
                      max={new Date().getFullYear() - 16}
                      required
                    />
                    <p className="text-xs text-gray-500">Âge calculé: {formData.age} ans</p>
                  </div>
                </div>
                {isSuperAdmin && (
                  <div className="space-y-2">
                    <Label>Ferme</Label>
                    <Select
                      value={formData.fermeId}
                      onValueChange={(value) =>
                        setFormData(prev => ({
                          ...prev,
                          fermeId: value,
                          chambre: '', // Clear chamber when farm changes
                          dortoir: ''  // Clear dortoir when farm changes
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une ferme" />
                      </SelectTrigger>
                      <SelectContent>
                        {fermes.map(ferme => (
                          <SelectItem key={ferme.id} value={ferme.id}>
                            {ferme.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Chambre</Label>
                    <Select
                      value={formData.chambre}
                      onValueChange={(value) => {
                        // Find the selected room from the available chambers (already filtered by ferme and gender)
                        const availableChambres = getAvailableChambres();
                        const selectedRoom = availableChambres.find(room => room.numero === value);
                        setFormData(prev => ({
                          ...prev,
                          chambre: value,
                          dortoir: selectedRoom ? (selectedRoom.genre === 'hommes' ? 'Dortoir Hommes' : 'Dortoir Femmes') : ''
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une chambre" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableChambres().length === 0 ? (
                          <div className="p-2 text-center text-sm text-gray-500">
                            {!formData.fermeId ? 'Sélectionnez d\'abord une ferme' :
                             !formData.sexe ? 'Sélectionnez d\'abord le sexe' :
                             'Aucune chambre disponible pour ce genre'}
                          </div>
                        ) : (
                          getAvailableChambres().map(room => {
                            const isAvailable = room.occupantsActuels < room.capaciteTotale;
                            const availableSpaces = room.capaciteTotale - room.occupantsActuels;
                            return (
                              <SelectItem
                                key={room.id}
                                value={room.numero}
                                disabled={!isAvailable && !editingWorker}
                              >
                                Chambre {room.numero} ({availableSpaces}/{room.capaciteTotale} places) - {room.genre}
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                    {formData.fermeId && formData.sexe && getAvailableChambres().length === 0 && (
                      <Alert className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          Aucune chambre {formData.sexe === 'homme' ? 'pour hommes' : 'pour femmes'} disponible dans cette ferme.
                          <br />
                          <span className="text-xs text-gray-600">
                            Vérifiez que des chambres ont été créées pour ce genre dans cette ferme.
                          </span>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dortoir">Dortoir</Label>
                    <Input
                      id="dortoir"
                      value={formData.dortoir}
                      onChange={(e) => setFormData(prev => ({ ...prev, dortoir: e.target.value }))}
                      placeholder="Sera rempli automatiquement"
                      readOnly
                      className="bg-gray-50"
                    />
                  </div>
                </div>

                {/* Date d'entrée */}
                <div className="space-y-2">
                  <Label htmlFor="dateEntree">Date d'entrée</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="dateEntree"
                      type="date"
                      value={formData.dateEntree}
                      onChange={(e) => setFormData(prev => ({ ...prev, dateEntree: e.target.value }))}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                {/* Exit fields - only show when editing */}
                {editingWorker && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="dateSortie">Date de sortie (optionnel)</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="dateSortie"
                          type="date"
                          value={formData.dateSortie}
                          onChange={(e) => {
                            const newDateSortie = e.target.value;
                            setFormData(prev => ({
                              ...prev,
                              dateSortie: newDateSortie,
                              // Automatically set status to inactif when exit date is added
                              statut: newDateSortie ? 'inactif' : 'actif'
                            }));
                          }}
                          className="pl-10"
                          min={formData.dateEntree}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="motif">Motif de sortie (optionnel)</Label>
                        <Select
                          value={formData.motif}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, motif: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un motif" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Aucun motif</SelectItem>
                            <SelectItem value="fin_contrat">Fin de contrat</SelectItem>
                            <SelectItem value="demission">Démission</SelectItem>
                            <SelectItem value="licenciement">Licenciement</SelectItem>
                            <SelectItem value="mutation">Mutation</SelectItem>
                            <SelectItem value="maladie">Maladie</SelectItem>
                            <SelectItem value="retraite">Retraite</SelectItem>
                            <SelectItem value="autre">Autre</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="statut">Statut</Label>
                        <Select
                          value={formData.statut}
                          onValueChange={(value: 'actif' | 'inactif') => setFormData(prev => ({ ...prev, statut: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="actif">Actif</SelectItem>
                            <SelectItem value="inactif">Inactif</SelectItem>
                          </SelectContent>
                        </Select>
                        {formData.dateSortie && formData.statut === 'actif' && (
                          <p className="text-xs text-orange-600">
                            ⚠️ Statut actif avec date de sortie - vérifiez si c'est correct
                          </p>
                        )}
                        {formData.dateSortie && formData.statut === 'inactif' && (
                          <p className="text-xs text-green-600">
                            ✅ Statut automatiquement défini comme inactif
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end space-x-2">
                  <Button variant="outline" type="button" onClick={() => setIsAddDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button 
                    type="submit"
                    disabled={loading}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600"
                  >
                    {loading ? 'Sauvegarde...' : (editingWorker ? 'Modifier' : 'Ajouter')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher par nom ou CIN..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            {isSuperAdmin && (
              <Select value={selectedFerme} onValueChange={setSelectedFerme}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Toutes les fermes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les fermes</SelectItem>
                  {fermes.map(ferme => (
                    <SelectItem key={ferme.id} value={ferme.id}>
                      {ferme.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={selectedGender} onValueChange={setSelectedGender}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Sexe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="homme">Hommes</SelectItem>
                <SelectItem value="femme">Femmes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Workers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Liste des ouvriers ({filteredWorkers.length})</span>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Filtres avancés
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workersLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Chargement des ouvriers...</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Nom</TableHead>
                    <TableHead className="whitespace-nowrap">CIN</TableHead>
                    {isSuperAdmin && <TableHead className="whitespace-nowrap">Ferme</TableHead>}
                    <TableHead className="whitespace-nowrap">Contact</TableHead>
                    <TableHead className="whitespace-nowrap">Sexe</TableHead>
                    <TableHead className="whitespace-nowrap">Âge</TableHead>
                    <TableHead className="whitespace-nowrap">Logement</TableHead>
                    <TableHead className="whitespace-nowrap">Date d'entrée</TableHead>
                    <TableHead className="whitespace-nowrap">Date de sortie</TableHead>
                    <TableHead className="whitespace-nowrap">Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorkers.map((worker) => (
                    <TableRow key={worker.id}>
                      <TableCell className="font-medium">{worker.nom}</TableCell>
                      <TableCell>{worker.cin}</TableCell>
                      {isSuperAdmin && (
                        <TableCell>
                          <span className="text-sm text-gray-600">
                            {getFermeName(worker.fermeId)}
                          </span>
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center text-sm text-gray-600">
                          <Phone className="mr-1 h-3 w-3" />
                          {worker.telephone}
                        </div>
                      </TableCell>
                      <TableCell>{getGenderBadge(worker.sexe)}</TableCell>
                      <TableCell>{worker.age} ans</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">Chambre {worker.chambre}</div>
                          <div className="text-gray-500 flex items-center">
                            <MapPin className="mr-1 h-3 w-3" />
                            {worker.dortoir}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar className="mr-1 h-3 w-3" />
                          {new Date(worker.dateEntree).toLocaleDateString('fr-FR')}
                        </div>
                      </TableCell>
                      <TableCell>
                        {worker.dateSortie ? (
                          <div className="text-sm">
                            <div className="flex items-center text-gray-600">
                              <Calendar className="mr-1 h-3 w-3" />
                              {new Date(worker.dateSortie).toLocaleDateString('fr-FR')}
                            </div>
                            {worker.motif && worker.motif !== 'none' && (
                              <div className="text-xs text-gray-500 mt-1">
                                {worker.motif.replace('_', ' ').charAt(0).toUpperCase() + worker.motif.replace('_', ' ').slice(1)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(worker)}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(worker)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDelete(worker.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
