import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMaterials,
  getMaterialByType,
  createMaterial,
  updateMaterial,
  Material,
} from '@/services/inventoryService';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

const QUERY_KEYS = {
  materials: ['materials'],
  materialByType: (type: string) => ['materials', 'type', type],
};

/**
 * Hook for fetching all materials
 */
export function useMaterials() {
  return useQuery<Material[]>({
    queryKey: QUERY_KEYS.materials,
    queryFn: getMaterials,
  });
}

/**
 * Hook for fetching a material by type
 */
export function useMaterialByType(materialType: string | null) {
  return useQuery<Material | null>({
    queryKey: QUERY_KEYS.materialByType(materialType || ''),
    queryFn: () => (materialType ? getMaterialByType(materialType) : Promise.resolve(null)),
    enabled: !!materialType,
  });
}

/**
 * Hook for creating a material
 */
export function useCreateMaterial() {
  const { language } = useLanguage();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMaterial,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.materials });
      toast.success(
        language === 'nl' ? 'Materiaal aangemaakt' : 'Material created'
      );
    },
    onError: (error) => {
      console.error('Error creating material:', error);
      toast.error(
        language === 'nl' ? 'Fout bij aanmaken materiaal' : 'Error creating material'
      );
    },
  });
}

/**
 * Hook for updating a material
 */
export function useUpdateMaterial() {
  const { language } = useLanguage();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Material> }) =>
      updateMaterial(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.materials });
      toast.success(
        language === 'nl' ? 'Materiaal bijgewerkt' : 'Material updated'
      );
    },
    onError: (error) => {
      console.error('Error updating material:', error);
      toast.error(
        language === 'nl' ? 'Fout bij bijwerken materiaal' : 'Error updating material'
      );
    },
  });
}

/**
 * Get localized material name
 */
export function getMaterialName(material: Material, language: 'en' | 'nl'): string {
  if (language === 'nl' && material.name_nl) {
    return material.name_nl;
  }
  return material.name;
}
