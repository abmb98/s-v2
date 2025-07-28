import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import {
  BedDouble,
  Plus,
  Search,
  Edit,
  Users,
  Home,
  AlertCircle,
  CheckCircle,
  Wifi
} from 'lucide-react';
import { useFirestore } from '@/hooks/useFirestore';
import { Room, Ferme, Worker } from '@shared/types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function Rooms() {
  const { user, isSuperAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFerme, setSelectedFerme] = useState('all');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Fetch data from Firebase with real-time updates
  const { data: allRooms, loading: roomsLoading, addDocument, updateDocument, deleteDocument } = useFirestore<Room>('rooms', true, true);
  const { data: fermes } = useFirestore<Ferme>('fermes', true, true);
  const { data: workers } = useFirestore<Worker>('workers', true, true);

  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recalculatingFerme, setRecalculatingFerme] = useState(false);
  const [formData, setFormData] = useState({
    numero: '',
    fermeId: user?.fermeId || '',
    genre: 'hommes' as 'hommes' | 'femmes',
    capaciteTotale: 4,
    occupantsActuels: 0,
    listeOccupants: [] as string[]
  });

  // Filter rooms based on user role and filters
  const filteredRooms = allRooms.filter(room => {
    // Role-based filtering
    if (!isSuperAdmin && user?.fermeId) {
      if (room.fermeId !== user.fermeId) return false;
    }
    
    // Search filter
    if (searchTerm && !room.numero.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    // Ferme filter (for superadmin)
    if (selectedFerme !== 'all' && room.fermeId !== selectedFerme) {
      return false;
    }
    
    // Genre filter
    if (selectedGenre !== 'all' && room.genre !== selectedGenre) {
      return false;
    }
    
    return true;
  });

  const getOccupancyStatus = (room: Room) => {
    const percentage = (room.occupantsActuels / room.capaciteTotale) * 100;
    if (percentage === 0) return { label: 'Libre', variant: 'secondary' as const, color: 'gray' };
    if (percentage < 100) return { label: 'Partiellement occupée', variant: 'default' as const, color: 'blue' };
    return { label: 'Complète', variant: 'destructive' as const, color: 'red' };
  };

  const getGenreBadge = (genre: string) => {
    return genre === 'hommes' 
      ? <Badge className="bg-blue-100 text-blue-800">Hommes</Badge>
      : <Badge className="bg-pink-100 text-pink-800">Femmes</Badge>;
  };

  const getFermeName = (fermeId: string) => {
    const ferme = fermes.find(f => f.id === fermeId);
    return ferme?.nom || fermeId;
  };

  const getOccupantNames = (room: Room) => {
    return room.listeOccupants.map(cin => {
      const worker = workers.find(w => w.cin === cin);
      return worker?.nom || cin;
    });
  };

  const recalculateFermeCapacity = async (fermeId: string) => {
    setRecalculatingFerme(true);
    try {
      console.log(`🔄 Recalculating capacity for ferme: ${fermeId}`);

      // Get all rooms for this ferme
      const fermeRooms = allRooms.filter(r => r.fermeId === fermeId);

      // Calculate total capacity and total chambers
      const totalCapacity = fermeRooms.reduce((total, room) => total + room.capaciteTotale, 0);
      const totalChambres = fermeRooms.length;

      console.log(`📊 Ferme ${fermeId} - Total capacity: ${totalCapacity}, Total chambers: ${totalChambres}`);

      // Update the ferme document
      const fermeRef = doc(db, 'fermes', fermeId);
      await updateDoc(fermeRef, {
        totalOuvriers: totalCapacity,
        totalChambres: totalChambres,
        updatedAt: new Date()
      });

      console.log(`✅ Successfully updated ferme ${fermeId} capacity to ${totalCapacity}`);
    } catch (error) {
      console.error('❌ Error recalculating ferme capacity:', error);
      throw error;
    } finally {
      setRecalculatingFerme(false);
    }
  };

  const handleEditRoom = (room: Room) => {
    setEditingRoom(room);
    setFormData({
      numero: room.numero,
      fermeId: room.fermeId,
      genre: room.genre,
      capaciteTotale: room.capaciteTotale,
      occupantsActuels: room.occupantsActuels,
      listeOccupants: room.listeOccupants
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;

    setLoading(true);
    setError('');

    try {
      // Validate capacity
      if (formData.capaciteTotale < formData.occupantsActuels) {
        setError('La nouvelle capacité ne peut pas être inférieure au nombre d\'occupants actuels');
        return;
      }

      // Update room data
      const updatedData = {
        numero: formData.numero,
        genre: formData.genre,
        capaciteTotale: formData.capaciteTotale,
        // Keep existing occupants data
        occupantsActuels: editingRoom.occupantsActuels,
        listeOccupants: editingRoom.listeOccupants
      };

      await updateDocument(editingRoom.id, updatedData);

      // Recalculate ferme capacity if the room capacity changed
      if (editingRoom.capaciteTotale !== formData.capaciteTotale) {
        console.log(`Room capacity changed from ${editingRoom.capaciteTotale} to ${formData.capaciteTotale}`);
        try {
          await recalculateFermeCapacity(editingRoom.fermeId);
          console.log('✅ Ferme capacity updated successfully');
        } catch (fermeError) {
          console.error('❌ Failed to update ferme capacity:', fermeError);
          // Room was updated but ferme capacity failed - show warning
          setError('Chambre mise à jour, mais erreur lors du recalcul de la capacité totale de la ferme');
        }
      }

      setIsEditDialogOpen(false);
      setEditingRoom(null);
      setFormData({
        numero: '',
        fermeId: user?.fermeId || '',
        genre: 'hommes',
        capaciteTotale: 4,
        occupantsActuels: 0,
        listeOccupants: []
      });
    } catch (error) {
      console.error('Error updating room:', error);
      setError('Erreur lors de la mise à jour de la chambre');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <BedDouble className="mr-3 h-8 w-8" />
            Gestion des chambres
          </h1>
          <div className="flex items-center space-x-3 mt-2">
            <p className="text-gray-600">
              {isSuperAdmin
                ? `${filteredRooms.length} chambres dans toutes les fermes`
                : `${filteredRooms.length} chambres dans votre ferme`
              }
            </p>
            <div className="flex items-center text-green-600 text-sm">
              <Wifi className="h-4 w-4 mr-1" />
              <span>Temps réel</span>
            </div>
          </div>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle chambre
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Ajouter une chambre</DialogTitle>
              <DialogDescription>
                Créez une nouvelle chambre dans le système
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="numero">Numéro de chambre</Label>
                <Input id="numero" placeholder="Ex: 301" />
              </div>
              <div className="space-y-2">
                <Label>Genre</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hommes">Hommes</SelectItem>
                    <SelectItem value="femmes">Femmes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacite">Capacité maximale</Label>
                <Input id="capacite" type="number" placeholder="4" />
              </div>
              {isSuperAdmin && (
                <div className="space-y-2">
                  <Label>Ferme</Label>
                  <Select>
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
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                {loading ? 'Sauvegarde...' : (editingRoom ? 'Modifier' : 'Créer')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher par numéro de chambre..."
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
            <Select value={selectedGenre} onValueChange={setSelectedGenre}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Genre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="hommes">Hommes</SelectItem>
                <SelectItem value="femmes">Femmes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Rooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRooms.map((room) => {
          const occupancyStatus = getOccupancyStatus(room);
          const occupancyPercentage = (room.occupantsActuels / room.capaciteTotale) * 100;
          const occupantNames = getOccupantNames(room);
          
          return (
            <Card key={room.id} className="transition-all duration-200 hover:shadow-lg">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${
                      occupancyPercentage === 0 ? 'bg-gray-100' :
                      occupancyPercentage < 100 ? 'bg-blue-100' : 'bg-red-100'
                    }`}>
                      <BedDouble className={`h-5 w-5 ${
                        occupancyPercentage === 0 ? 'text-gray-600' :
                        occupancyPercentage < 100 ? 'text-blue-600' : 'text-red-600'
                      }`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold">
                        Chambre {room.numero}
                      </CardTitle>
                      {isSuperAdmin && (
                        <p className="text-sm text-gray-500 flex items-center mt-1">
                          <Home className="mr-1 h-3 w-3" />
                          {getFermeName(room.fermeId)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    {getGenreBadge(room.genre)}
                    <Badge variant={occupancyStatus.variant}>
                      {occupancyStatus.label}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Occupancy */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-600">Occupation</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {room.occupantsActuels}/{room.capaciteTotale}
                      </span>
                    </div>
                    <Progress value={occupancyPercentage} className="h-2" />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{room.occupantsActuels} occupants</span>
                      <span>{room.capaciteTotale - room.occupantsActuels} places libres</span>
                    </div>
                  </div>

                  {/* Occupants */}
                  {occupantNames.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-600 mb-2 flex items-center">
                        <Users className="mr-1 h-3 w-3" />
                        Occupants actuels
                      </h4>
                      <div className="space-y-1">
                        {occupantNames.map((name, index) => (
                          <div key={index} className="text-sm text-gray-900 bg-gray-50 px-2 py-1 rounded">
                            {name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Status indicator */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex items-center text-sm">
                      {occupancyPercentage === 0 ? (
                        <CheckCircle className="mr-1 h-4 w-4 text-green-600" />
                      ) : occupancyPercentage < 100 ? (
                        <AlertCircle className="mr-1 h-4 w-4 text-blue-600" />
                      ) : (
                        <AlertCircle className="mr-1 h-4 w-4 text-red-600" />
                      )}
                      <span className="text-gray-600">
                        {occupancyPercentage === 0 ? 'Disponible' :
                         occupancyPercentage < 100 ? 'Partiellement occupée' : 'Complète'}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditRoom(room)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Modifier
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit Room Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier la chambre</DialogTitle>
            <DialogDescription>
              Modifiez les informations de la chambre {editingRoom?.numero}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveRoom} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-numero">Numéro de chambre</Label>
              <Input
                id="edit-numero"
                value={formData.numero}
                onChange={(e) => setFormData(prev => ({ ...prev, numero: e.target.value }))}
                placeholder="Ex: 301"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Genre</Label>
              <Select
                value={formData.genre}
                onValueChange={(value: 'hommes' | 'femmes') => setFormData(prev => ({ ...prev, genre: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hommes">Hommes</SelectItem>
                  <SelectItem value="femmes">Femmes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-capacite">Capacité maximale</Label>
              <Input
                id="edit-capacite"
                type="number"
                value={formData.capaciteTotale}
                onChange={(e) => setFormData(prev => ({ ...prev, capaciteTotale: parseInt(e.target.value) || 0 }))}
                placeholder="4"
                min="1"
                required
              />
              {editingRoom && formData.capaciteTotale < editingRoom.occupantsActuels && (
                <p className="text-sm text-red-600">
                  ⚠️ La capacité ne peut pas être inférieure au nombre d'occupants actuels ({editingRoom.occupantsActuels})
                </p>
              )}
              {editingRoom && formData.capaciteTotale !== editingRoom.capaciteTotale && (
                <p className="text-sm text-blue-600">
                  ℹ️ La capacité totale de la ferme sera automatiquement recalculée
                </p>
              )}
            </div>

            {editingRoom && editingRoom.occupantsActuels > 0 && (
              <div className="space-y-2">
                <Label>Occupants actuels</Label>
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  <p className="font-medium">{editingRoom.occupantsActuels} occupant(s) dans cette chambre</p>
                  <p className="text-xs mt-1">
                    Ces occupants seront conservés après la modification
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}

            {recalculatingFerme && (
              <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Recalcul de la capacité totale de la ferme en cours...
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setError('');
                }}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={loading || recalculatingFerme || (editingRoom && formData.capaciteTotale < editingRoom.occupantsActuels)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                {loading ? 'Sauvegarde...' : recalculatingFerme ? 'Recalcul...' : 'Sauvegarder'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
