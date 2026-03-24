import { create } from 'xmlbuilder2';
import { CRMProperty } from './zap-mapper';

// Maps CRM internal property types to Imovelweb WSDL Types
export function mapImovelwebPropertyType(crmType: string | null): string {
    switch (crmType) {
        case 'apartment':
            return 'Apartamento';
        case 'house':
            return 'Casa';
        case 'condominium_house':
            return 'Casa de Condominio';
        case 'land':
            return 'Terreno'; // Imovelweb prefers Terreno over Lote/Terreno often
        case 'commercial':
            return 'Comercial';
        case 'commercial_space':
            return 'Comercial';
        default:
            return 'Outro'; // Fallback
    }
}

function mapImovelwebFinalidade(transactionType?: string | null): string {
    if (transactionType === 'rent' || transactionType === 'seasonal') {
        return 'Aluguel';
    }
    return 'Venda';
}

function normalizeState(state?: string | null): string | null {
    if (!state) return null;
    return state.trim().toUpperCase();
}

function normalizeZip(zip?: string | null): string | null {
    if (!zip) return null;
    const digits = zip.replace(/\D/g, '');
    return digits || null;
}

/**
 * Generates the Imovelweb XML string for a list of properties.
 * This is an approximation of their DataWeb/XML format which focuses
 * on Portuguese tags.
 */
export function generateImovelwebXml(properties: CRMProperty[], publisher?: { name: string, email?: string, phone?: string }): string {
    const root = create({ version: '1.0', encoding: 'UTF-8' })
        .ele('Carga')
        .ele('Imoveis');

    properties.forEach((prop) => {
        const listingId = prop.public_code || prop.id;
        const imovel = root.ele('Imovel');

        imovel.ele('CodigoImovel').txt(listingId).up();
        imovel.ele('TipoImovel').txt(mapImovelwebPropertyType(prop.type)).up();

        // Most Imovelweb feeds use Finalidade: Venda ou Aluguel
        imovel.ele('Finalidade').txt(mapImovelwebFinalidade(prop.transaction_type)).up();

        const isRental = prop.transaction_type === 'rent' || prop.transaction_type === 'seasonal';

        // The current CRM stores a single price field, so we map it to the
        // correct tag based on the declared transaction type.
        if (prop.price) {
            imovel.ele(isRental ? 'PrecoLocacao' : 'PrecoVenda').txt(prop.price.toString()).up();
        }

        if (prop.condo_fee) imovel.ele('PrecoCondominio').txt(prop.condo_fee.toString()).up();
        if (prop.iptu) imovel.ele('ValorIPTU').txt(prop.iptu.toString()).up();

        imovel.ele('SubTipoImovel').txt('Padrão').up(); // Generic default
        imovel.ele('TituloImovel').txt(prop.title || 'Imóvel').up();
        imovel.ele('Observacao').txt(prop.description || 'Sem descrição').up();

        // Details
        const features = prop.features || {};
        if (features.bedrooms) imovel.ele('QtdDormitorios').txt(features.bedrooms.toString()).up();
        if (features.suites) imovel.ele('QtdSuites').txt(features.suites.toString()).up();
        if (features.bathrooms) imovel.ele('QtdBanheiros').txt(features.bathrooms.toString()).up();
        if (features.garage) imovel.ele('QtdVagas').txt(features.garage.toString()).up();
        if (features.area) {
            imovel.ele('AreaUtil').txt(features.area.toString()).up();
            imovel.ele('AreaTotal').txt(features.area.toString()).up(); // Imovelweb uses AreaTotal and AreaUtil
        }

        // Location
        const address = prop.address || {};
        if (address.city) imovel.ele('Cidade').txt(address.city).up();
        if (address.neighborhood) imovel.ele('Bairro').txt(address.neighborhood).up();
        if (address.street) imovel.ele('Endereco').txt(address.street).up();
        const normalizedZip = normalizeZip(address.zip);
        const normalizedState = normalizeState(address.state);
        if (normalizedZip) imovel.ele('CEP').txt(normalizedZip).up();
        if (normalizedState) imovel.ele('UF').txt(normalizedState).up();

        // Media (Images) - Imovelweb standard typically expects <Fotos><Foto><URLFoto>
        if (prop.images && prop.images.length > 0) {
            const fotos = imovel.ele('Fotos');
            prop.images.forEach((imgUrl, index) => {
                const foto = fotos.ele('Foto');
                foto.ele('URLArquivo').txt(imgUrl || '').up();
                foto.ele('Principal').txt(index === 0 ? '1' : '0').up();
                foto.up();
            });
            fotos.up(); // end Fotos
        }

        if (publisher) {
            const pub = imovel.ele('Publicador');
            pub.ele('Nome').txt(publisher.name || 'Anunciante').up();
            if (publisher.email) pub.ele('Email').txt(publisher.email).up();
            if (publisher.phone) pub.ele('Telefone').txt(publisher.phone).up();
            pub.up(); // end Publicador
        }

        imovel.up(); // end Imovel
    });

    return root.end({ prettyPrint: true });
}
