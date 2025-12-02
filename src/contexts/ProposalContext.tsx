import React, { createContext, useContext, useState, useEffect } from 'react';

interface AddedProposalItem {
  proposalId: string;
  flightCardId: string;
  itemIds: Set<string>;
}

interface ProposalContextType {
  addedProposals: Map<string, AddedProposalItem>; // key: flightCardId, value: proposal info
  lastSelectedProposalId: string | null;
  addToProposal: (flightCardId: string, proposalId: string, itemIds: Set<string>) => void;
  removeFromProposal: (flightCardId: string) => void;
  getProposalCount: (proposalId: string) => number;
  setLastSelectedProposalId: (proposalId: string | null) => void;
}

const ProposalContext = createContext<ProposalContextType | undefined>(undefined);

export const ProposalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [addedProposals, setAddedProposals] = useState<Map<string, AddedProposalItem>>(new Map());
  const [lastSelectedProposalId, setLastSelectedProposalIdState] = useState<string | null>(() => {
    // Load from localStorage on init
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lastSelectedProposalId');
    }
    return null;
  });

  const addToProposal = (flightCardId: string, proposalId: string, itemIds: Set<string>) => {
    setAddedProposals(prev => {
      const newMap = new Map(prev);
      newMap.set(flightCardId, { proposalId, flightCardId, itemIds });
      return newMap;
    });
  };

  const removeFromProposal = (flightCardId: string) => {
    setAddedProposals(prev => {
      const newMap = new Map(prev);
      newMap.delete(flightCardId);
      return newMap;
    });
  };

  const getProposalCount = (proposalId: string) => {
    let count = 0;
    addedProposals.forEach(item => {
      if (item.proposalId === proposalId) {
        count++;
      }
    });
    return count;
  };

  const setLastSelectedProposalId = (proposalId: string | null) => {
    setLastSelectedProposalIdState(proposalId);
    if (typeof window !== 'undefined') {
      if (proposalId) {
        localStorage.setItem('lastSelectedProposalId', proposalId);
      } else {
        localStorage.removeItem('lastSelectedProposalId');
      }
    }
  };

  return (
    <ProposalContext.Provider value={{ addedProposals, lastSelectedProposalId, addToProposal, removeFromProposal, getProposalCount, setLastSelectedProposalId }}>
      {children}
    </ProposalContext.Provider>
  );
};

export const useProposalContext = () => {
  const context = useContext(ProposalContext);
  if (!context) {
    throw new Error('useProposalContext must be used within ProposalProvider');
  }
  return context;
};

