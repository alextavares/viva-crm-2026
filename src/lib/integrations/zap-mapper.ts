import { create } from 'xmlbuilder2';

// Basic CRM types needed for the mapper
export type CRMProperty = {
    id: string;
    external_id: string | null;
    public_code: string;
    title: string;
    description: string | null;
    price: number | null;
    condo_fee?: number | null;
    iptu?: number | null;
    type: string | null; // apartment, house, land, commercial
    transaction_type?: string | null; // sale, rent, seasonal
    status: string | null; // available, sold, rented
    features: {
        bedrooms?: number | null;
        bathrooms?: number | null;
        suites?: number | null;
        garage?: number | null;
        area?: number | null;
        [key: string]: unknown;
    } | null;
    address: {
        full_address?: string | null;
        street?: string | null;
        number?: string | null;
        neighborhood?: string | null;
        city?: string | null;
        state?: string | null;
        zip?: string | null;
        country?: string | null;
        lat?: number | null;
        lng?: number | null;
        [key: string]: unknown;
    } | null;
    images: string[];
    image_paths?: string[] | null;
    created_at: string;
    updated_at: string;
};

// Maps CRM internal property types to Zap/VivaReal Types
export function mapPropertyType(crmType: string | null): string {
    switch (crmType) {
        case 'apartment':
            return 'Apartamento';
        case 'house':
            return 'Casa';
        case 'condominium_house':
            return 'Casa de Condominio';
        case 'land':
            return 'Lote/Terreno';
        case 'commercial':
            return 'Comercial';
        case 'commercial_space':
            return 'Comercial';
        default:
            return 'Outros'; // Fallback
    }
}

export function mapTransactionType(property: CRMProperty): 'For Sale' | 'For Rent' {
    if (property.transaction_type === 'rent' || property.transaction_type === 'seasonal') {
        return 'For Rent';
    }
    return 'For Sale';
}

/**
 * Generates the DataZAP XML string for a list of properties.
 */
export function generateZapXml(properties: CRMProperty[]): string {
    const root = create({ version: '1.0', encoding: 'UTF-8' })
        .ele('ListingDataFeed')
        .ele('Header')
        .ele('Provider').txt('VivaCRM').up()
        .ele('Email').txt('suporte@vivacrm.com.br').up()
        .ele('ContactName').txt('VivaCRM Support').up()
        .ele('PublishDate').txt(new Date().toISOString()).up()
        .up()
        .ele('Listings');

    properties.forEach((prop) => {
        const listingId = prop.public_code || prop.id;
        const listing = root.ele('Listing');

        listing.ele('ListingID').txt(listingId).up();
        listing.ele('Title').txt(prop.title).up();

        // Zap uses CDATA for Description often, xmlbuilder2 handles escaping if .txt() is used
        listing.ele('Description').txt(prop.description || '').up();

        // Transaction Type
        listing.ele('TransactionType').txt(mapTransactionType(prop)).up();

        // Details
        const details = listing.ele('Details');
        details.ele('PropertyType').txt(mapPropertyType(prop.type)).up();

        const features = prop.features || {};
        if (features.bedrooms) details.ele('Bedrooms').txt(features.bedrooms.toString()).up();
        if (features.bathrooms) details.ele('Bathrooms').txt(features.bathrooms.toString()).up();
        if (features.suites) details.ele('Suites').txt(features.suites.toString()).up();
        if (features.garage) details.ele('Garage').txt(features.garage.toString()).up();
        if (features.area) details.ele('LivingArea').txt(features.area.toString()).up();

        // We only send ListPrice if we have a price
        if (prop.price) {
            details.ele('ListPrice').txt(prop.price.toString()).up();
        }
        details.up(); // end Details

        // Location
        const address = prop.address || {};
        const location = listing.ele('Location');
        // Using displayAddress if available, otherwise fallback to parts
        const displayAddress = location.ele('displayAddress');
        displayAddress.txt('All').up(); // Options: All, Neighborhood, Street

        if (address.street) location.ele('Address').txt(address.street).up();
        if (address.neighborhood) location.ele('Neighborhood').txt(address.neighborhood).up();
        if (address.city) location.ele('City').txt(address.city).up();
        if (address.state) location.ele('State').txt(address.state).up();
        if (address.zip) location.ele('PostalCode').txt(address.zip).up();
        location.up(); // end Location

        // Media (Images)
        if (prop.images && prop.images.length > 0) {
            const media = listing.ele('Media');
            prop.images.forEach((imgUrl, index) => {
                const item = media.ele('Item', { medium: 'image' });
                item.txt(imgUrl);
                // First image is usually primary
                if (index === 0) item.att('primary', 'true');
                item.up();
            });
            media.up(); // end Media
        }

        // Publisher info (optional but good)
        listing.ele('ContactInfo')
            .ele('Name').txt('Atendimento').up()
            .up();

        listing.up(); // end Listing
    });

    return root.end({ prettyPrint: true });
}
