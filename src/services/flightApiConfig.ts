import ITAMatrixService from './itaMatrixApi';
import BiirdeeService from './biirdeeApi';
import { FlightSearchParams, SearchResponse } from '../types/flight';

interface FlightApiService {
  searchFlights(params: FlightSearchParams, onProgress?: (solution: any) => void): Promise<SearchResponse>;
}

type ApiProvider = 'biirdee' | 'itamatrix';

const API_PROVIDER: ApiProvider = 'biirdee';

const getFlightApiService = (): FlightApiService => {
  switch (API_PROVIDER) {
    case 'biirdee':
      return BiirdeeService;
    case 'itamatrix':
      return ITAMatrixService;
    default:
      return BiirdeeService;
  }
};

export const FlightApi = getFlightApiService();
export { API_PROVIDER };
