import { supabase } from '../lib/supabase';

export interface RouteConfiguration {
  id: string;
  user_id: string;
  destination_city: string;
  region: 'north_america' | 'europe' | 'asia' | 'south_america' | 'australia';
  strategy_type: 'frt_origins' | 'frt_destinations' | 'skiplag_finals';
  airport_codes: string[];
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

class RouteConfigurationService {
  async getActiveConfigurations(): Promise<RouteConfiguration[]> {
    try {
      const { data, error } = await supabase
        .from('route_configurations')
        .select('*')
        .eq('is_active', true)
        .order('destination_city', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching route configurations:', error);
      return [];
    }
  }

  async getConfigurationsForDestination(
    destinationCity: string, 
    strategyType?: 'frt_origins' | 'frt_destinations' | 'skiplag_finals'
  ): Promise<RouteConfiguration[]> {
    try {
      let query = supabase
        .from('route_configurations')
        .select('*')
        .eq('destination_city', destinationCity)
        .eq('is_active', true);

      if (strategyType) {
        query = query.eq('strategy_type', strategyType);
      }

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching destination configurations:', error);
      return [];
    }
  }

  async createConfiguration(config: Omit<RouteConfiguration, 'id' | 'created_at' | 'updated_at'>): Promise<RouteConfiguration | null> {
    try {
      const { data, error } = await supabase
        .from('route_configurations')
        .insert(config)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating route configuration:', error);
      throw error;
    }
  }

  async updateConfiguration(id: string, updates: Partial<RouteConfiguration>): Promise<void> {
    try {
      const { error } = await supabase
        .from('route_configurations')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating route configuration:', error);
      throw error;
    }
  }

  async deleteConfiguration(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('route_configurations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting route configuration:', error);
      throw error;
    }
  }

  // Smart routing helpers
  getSmartAirportsForStrategy(
    destinationCity: string,
    strategyType: 'frt_origins' | 'frt_destinations' | 'skiplag_finals',
    configurations: RouteConfiguration[]
  ): string[] {
    const relevantConfigs = configurations.filter(
      config => config.destination_city === destinationCity && config.strategy_type === strategyType
    );

    if (relevantConfigs.length === 0) return [];

    // Combine all airport codes from relevant configurations
    const smartAirports = [...new Set(relevantConfigs.flatMap(config => config.airport_codes))];
    return smartAirports;
  }

  getRegionalDefaults(region: 'north_america' | 'europe' | 'asia' | 'south_america' | 'australia'): string[] {
    const defaults = {
      north_america: ['LAX', 'JFK', 'ORD', 'DFW', 'DEN', 'ATL', 'BOS', 'IAD', 'SFO', 'SEA', 'YVR', 'YYZ'],
      europe: ['LHR', 'CDG', 'FRA', 'AMS', 'MAD', 'FCO', 'MUC', 'VIE', 'ZUR', 'CPH', 'ARN', 'OSL'],
      asia: ['NRT', 'ICN', 'PVG', 'HKG', 'SIN', 'BKK', 'KUL', 'CGK', 'MNL', 'TPE', 'DEL', 'BOM'],
      south_america: ['GRU', 'SCL', 'LIM', 'BOG', 'EZE', 'GIG', 'UIO', 'CCS', 'ASU', 'MVD'],
      australia: ['SYD', 'MEL', 'BNE', 'PER', 'ADL', 'DRW', 'CNS', 'AKL', 'CHC', 'WLG']
    };

    return defaults[region] || [];
  }
}

export default new RouteConfigurationService();