export type TailscaleEvents = TailscaleEvent[];

export interface TailscaleEvent {
	timestamp: string;
	version: number;
	type: string;
	tailnet: string;
	message: string;
	data?: TailscaleEventData;
}

export interface TailscaleEventData {
	user?: string;
	url: string;
	actor: string;
	oldRoles?: string[];
	newRoles?: string[];
	nodeID?: string;
	deviceName?: string;
	managedBy?: string;
	expiration?: string;
	newPolicy?: string;
	oldPolicy?: string;
}
