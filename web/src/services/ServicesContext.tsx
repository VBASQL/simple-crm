import { createContext, useContext, type ReactNode } from 'react';
import { db } from '../firebase/client.js';
import { createFirestoreServices, type Services } from './firestoreServices.js';

const defaultServices = createFirestoreServices(db);
const ServicesContext = createContext<Services>(defaultServices);

/** Inject the data services. Tests can pass fakes; the app uses Firestore. */
export function ServicesProvider({
  children,
  services = defaultServices,
}: {
  children: ReactNode;
  services?: Services;
}) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  return useContext(ServicesContext);
}
