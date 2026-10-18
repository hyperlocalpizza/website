/**
 * VIPizza — Internationalization (i18n).
 * Supports English (default), Italian, and Spanish.
 *
 * Usage:
 *   - Add `data-i18n="key"` to any element to translate its text content.
 *   - Add `data-i18n-placeholder="key"` to translate a placeholder.
 *   - Add `data-i18n-aria="key"` to translate an aria-label.
 *   - Call VIPizza.i18n.t(key) in JS to get a translated string.
 *   - Call VIPizza.i18n.setLang(code) to switch language.
 */
(function () {
  "use strict";

  const LANG_KEY = "vipizza_lang";
  const DEFAULT_LANG = "en";

  const FLAGS = {
    en: "🇬🇧",
    it: "🇮🇹",
    es: "🇪🇸"
  };

  const LANG_NAMES = {
    en: "English",
    it: "Italiano",
    es: "Español"
  };

  const translations = {
    en: {
      // Header / nav
      "nav.menu": "Menu",
      "nav.info": "Info",
      "nav.admin": "Staff area",
      "cart.open": "Open cart",
      "cart.close": "Close cart",

      // Hero
      "hero.eyebrow": "Pizza made right",
      "hero.title": "Your hot moment,<br />fresh out of the oven.",
      "hero.sub": "Choose from the menu, customize your pizza and get it still steaming.",
      "hero.cta": "Explore the menu",

      // Menu section
      "menu.eyebrow": "The menu",
      "menu.title": "Choose your pizza",
      "menu.loading": "Loading menu...",
      "menu.error": "Unable to load the menu. Try again later.",
      "menu.empty": "The menu is not available right now.",
      "menu.noCategories": "No categories available.",
      "menu.defaultDesc": "Fresh ingredients and long-rising dough.",
      "menu.add": "Add",
      "menu.remove": "Remove",

      // Info section
      "info.eyebrow": "Info",
      "info.title": "How it works",
      "info.choose.title": "Choose",
      "info.choose.desc": "Pick your favorite pizzas from the menu and add them to the cart.",
      "info.order.title": "Order",
      "info.order.desc": "Enter your details and choose pickup or home delivery.",
      "info.enjoy.title": "Enjoy",
      "info.enjoy.desc": "Get your pizza still steaming, fresh out of the oven.",

      // Footer
      "footer.tagline": "Pizza made right.",
      "footer.admin": "Staff area",

      // Cart
      "cart.title": "Your order",
      "cart.empty": "Add a pizza to get started.",
      "cart.total": "Total",
      "cart.checkout": "Proceed to order",

      // Checkout
      "checkout.title": "Complete your order",
      "checkout.close": "Close",
      "checkout.name": "Full name",
      "checkout.name.ph": "Mario Rossi",
      "checkout.phone": "Phone",
      "checkout.phone.ph": "333 123 4567",
      "checkout.type": "Pickup or delivery",
      "checkout.pickup": "Pickup",
      "checkout.delivery": "Delivery",
      "checkout.slot": "Preparation time",
      "checkout.slot.ph": "Select a time",
      "checkout.slot.full": "full",
      "checkout.slot.spots": "spots",
      "checkout.slot.hintEmpty": "Add a pizza to choose a time.",
      "checkout.slot.hintSelected": "Time selected for {count} {pizza}.",
      "checkout.slot.pizza": "pizza",
      "checkout.slot.pizzas": "pizzas",
      "checkout.address": "Delivery address",
      "checkout.address.street": "Street address",
      "checkout.address.street.ph": "1234 W Orchard Hill Dr",
      "checkout.address.apt": "Apt / floor (optional)",
      "checkout.address.apt.ph": "Apt 2B",
      "checkout.address.city": "City",
      "checkout.address.city.ph": "City",
      "checkout.address.state": "State / region",
      "checkout.address.state.ph": "State / region",
      "checkout.address.zip": "ZIP / postal code",
      "checkout.address.zip.ph": "Postal code",
      "checkout.address.country": "Country",
      "checkout.address.country.ph": "Country",
      "checkout.address.attribution": "Powered by",
      "checkout.address.apiKeyMissing": "Address suggestions need a Geoapify API key. You can enter your address manually.",
      "checkout.address.searching": "Searching addresses...",
      "checkout.address.noResults": "No matching addresses found. You can enter your address manually.",
      "checkout.address.searchError": "Address suggestions are temporarily unavailable. You can enter your address manually.",
      "checkout.address.ready": "Address details entered.",
      "checkout.address.selected": "Address selected from the map.",
      "checkout.notes": "Kitchen notes (optional)",
      "checkout.notes.ph": "E.g. no onion, well done...",
      "checkout.submit": "Send order",
      "checkout.submitting": "Sending...",
      "checkout.err.incomplete": "Please complete the required fields.",
      "checkout.err.address": "Please enter the street address and city.",
      "checkout.err.slot": "Please choose a preparation time.",
      "checkout.err.slotFull": "This time has no more spots. Choose another one.",
      "checkout.err.setup": "Order checkout needs a database update. Please contact us to place your order.",
      "checkout.err.generic": "Unable to send the order. Please try again.",

      // Confirmation
      "confirm.title": "Order received!",
      "confirm.text": "Thank you! Your order has been sent to the kitchen.",
      "confirm.codeLabel": "Your tracking code",
      "confirm.note": "Keep this code to pick up or track your order.",
      "confirm.close": "Perfect",

      // Admin — login
      "admin.login.title": "Staff area",
      "admin.login.sub": "Sign in to manage orders, times, inventory and menu.",
      "admin.login.email": "Email",
      "admin.login.email.ph": "staff@vipizza.it",
      "admin.login.password": "Password",
      "admin.login.btn": "Sign in",
      "admin.login.signing": "Signing in...",
      "admin.login.err.empty": "Enter email and password.",
      "admin.login.err.invalid": "Invalid credentials. Try again.",
      "admin.logout": "Sign out",
      "admin.connecting": "Connecting...",
      "admin.connected": "Connected",
      "admin.reconnecting": "Reconnecting...",

      // Admin — tabs
      "admin.tab.orders": "Orders",
      "admin.tab.slots": "Times",
      "admin.tab.inventory": "Inventory",
      "admin.tab.menu": "Menu",
      "admin.tab.content": "Site content",
      "admin.tab.analytics": "Analytics",
      "admin.analytics.eyebrow": "Business",
      "admin.analytics.title": "Weekly sales",
      "admin.analytics.period": "Last 12 weeks: {start} – {end}",
      "admin.analytics.refresh": "Refresh",
      "admin.analytics.cost": "Ingredient cost",
      "admin.analytics.gain": "Gain",
      "admin.analytics.pizzas": "Pizzas sold",
      "admin.analytics.week": "Week of",
      "admin.analytics.legend": "Chart legend",
      "admin.analytics.chartAria": "Weekly ingredient cost, gain and pizzas sold chart. Exact values are listed in the table below.",
      "admin.analytics.countNote": "Counts include all non-canceled orders.",
      "admin.analytics.estimateNote": "Orders placed before cost snapshots were enabled use current menu costs and gains as estimates.",
      "admin.analytics.loadError": "Unable to load weekly sales data.",
      "admin.content.eyebrow": "Website",
      "admin.content.title": "Site content",
      "admin.content.description": "Edit customer-facing headings and messages. Leave a field blank to use its default. Customers see published changes on their next visit.",
      "admin.content.languages": "Content language",
      "admin.content.save": "Save and publish",
      "admin.content.saved": "Site content published.",
      "admin.content.loadError": "Unable to load site content.",
      "admin.content.saveError": "Unable to publish changes. Try again.",
      "admin.content.unknownError": "Unknown error.",
      "admin.content.groupHero": "Hero",
      "admin.content.groupMenu": "Menu section",
      "admin.content.groupInfo": "How it works",
      "admin.content.groupFooter": "Footer",
      "admin.content.heroEyebrow": "Short introduction",
      "admin.content.heroTitle": "Main title",
      "admin.content.heroSub": "Supporting message",
      "admin.content.heroCta": "Main button",
      "admin.content.menuEyebrow": "Menu introduction",
      "admin.content.menuTitle": "Menu heading",
      "admin.content.infoEyebrow": "Information introduction",
      "admin.content.infoTitle": "Information heading",
      "admin.content.chooseTitle": "Choose heading",
      "admin.content.chooseDesc": "Choose message",
      "admin.content.orderTitle": "Order heading",
      "admin.content.orderDesc": "Order message",
      "admin.content.enjoyTitle": "Enjoy heading",
      "admin.content.enjoyDesc": "Enjoy message",
      "admin.content.footerTagline": "Footer tagline",

      // Admin — orders
      "admin.orders.eyebrow": "Orders",
      "admin.orders.title": "Orders in queue",
      "admin.orders.active": "active",
      "admin.orders.today": "today",
      "admin.orders.empty": "No orders. Waiting for new ones...",
      "admin.orders.delivery": "Delivery",
      "admin.orders.pickup": "Pickup",
      "admin.orders.total": "Total:",
      "admin.orders.advance": "→ {next}",
      "admin.orders.cancel": "Cancel",
      "admin.orders.cancelConfirm": "Cancel this order?",
      "admin.orders.newOrder": "New order #{tracking}!",
      "admin.orders.loadError": "Unable to load orders.",

      // Admin — slots
      "admin.slots.eyebrow": "Times",
      "admin.slots.title": "Pickup slots",
      "admin.slots.add": "+ New slot",
      "admin.slots.empty": "No slots configured.",
      "admin.slots.active": "Active",
      "admin.slots.inactive": "Inactive",
      "admin.slots.capacity": "{reserved} / {max} pizzas reserved · {remaining} free",
      "admin.slots.toggleOn": "Deactivate",
      "admin.slots.toggleOff": "Activate",
      "admin.slots.edit": "Edit",
      "admin.slots.delete": "Delete",
      "admin.slots.deleteConfirm": "Delete this slot?",
      "admin.slots.deleted": "Slot deleted.",
      "admin.slots.loadError": "Unable to load slots.",

      // Admin — inventory
      "admin.inv.eyebrow": "Inventory",
      "admin.inv.title": "Inventory",
      "admin.inv.add": "+ New item",
      "admin.inv.empty": "No items in stock.",
      "admin.inv.low": "Low stock",
      "admin.inv.ok": "OK",
      "admin.inv.threshold": "Min threshold: {value} {unit}",
      "admin.inv.stockValue": "Current stock value",
      "admin.inv.unitCost": "Cost: {price} / {unit}",
      "admin.inv.itemValue": "Stock value: {value}",
      "admin.inv.edit": "Edit",
      "admin.inv.delete": "Delete",
      "admin.inv.deleteConfirm": "Delete this item?",
      "admin.inv.deleted": "Item deleted.",
      "admin.inv.loadError": "Unable to load inventory.",
      "admin.inv.inUseError": "This ingredient is used in a menu recipe and cannot be deleted.",

      // Admin — menu
      "admin.menu.eyebrow": "Menu",
      "admin.menu.title": "Menu management",
      "admin.menu.add": "+ New pizza",
      "admin.menu.empty": "No items in the menu.",
      "admin.menu.available": "Available",
      "admin.menu.unavailable": "Unavailable",
      "admin.menu.hide": "Hide",
      "admin.menu.show": "Show",
      "admin.menu.edit": "Edit",
      "admin.menu.delete": "Delete",
      "admin.menu.deleteConfirm": "Delete this item from the menu?",
      "admin.menu.deleted": "Item deleted.",
      "admin.menu.loadError": "Unable to load the menu.",
      "admin.menu.costBreakdown": "Ingredients: {cost} · Gain: {gain}",

      // Admin — editor modal
      "admin.editor.title": "Edit",
      "admin.editor.close": "Close",
      "admin.editor.save": "Save",
      "admin.editor.saved": "Saved.",
      "admin.editor.error": "Unable to save. Check the data and try again.",
      "admin.editor.slot.new": "New slot",
      "admin.editor.slot.edit": "Edit slot",
      "admin.editor.slot.time": "Time (HH:MM)",
      "admin.editor.slot.capacity": "Capacity (pizzas)",
      "admin.editor.slot.reserved": "Reserved",
      "admin.editor.slot.active": "Active",
      "admin.editor.slot.yes": "Yes",
      "admin.editor.slot.no": "No",
      "admin.editor.inv.new": "New item",
      "admin.editor.inv.edit": "Edit item",
      "admin.editor.inv.name": "Name",
      "admin.editor.inv.unit": "Unit",
      "admin.editor.inv.qty": "Quantity",
      "admin.editor.inv.unitCost": "Cost per unit ($)",
      "admin.editor.inv.unitCostHint": "Cost is per {unit} in stock.",
      "admin.editor.inv.threshold": "Min threshold",
      "admin.editor.menu.new": "New pizza",
      "admin.editor.menu.edit": "Edit item",
      "admin.editor.menu.name": "Name",
      "admin.editor.menu.category": "Category",
      "admin.editor.menu.desc": "Description",
      "admin.editor.menu.price": "Final price ($)",
      "admin.editor.menu.ingredientCost": "Ingredient cost per pizza",
      "admin.editor.menu.gain": "Gain per pizza ($)",
      "admin.editor.menu.finalPrice": "Pizza price (cost + gain)",
      "admin.editor.menu.available": "Available",
      "admin.editor.menu.ingredients": "Recipe ingredients",
      "admin.editor.menu.addIngredient": "Add ingredient",
      "admin.editor.menu.ingredient": "Ingredient",
      "admin.editor.menu.chooseIngredient": "Choose ingredient",
      "admin.editor.menu.ingredientQuantity": "Amount per pizza",
      "admin.editor.menu.removeIngredient": "Remove ingredient",
      "admin.editor.menu.ingredientError": "Choose each ingredient once and enter an amount greater than zero.",
      "admin.editor.menu.photo": "JPEG photo",
      "admin.editor.menu.photoHint": "JPEG only, up to 5 MB.",
      "admin.editor.menu.photoError": "Choose a JPEG photo up to 5 MB."
    },

    it: {
      "nav.menu": "Menu",
      "nav.info": "Info",
      "nav.admin": "Area staff",
      "cart.open": "Apri il carrello",
      "cart.close": "Chiudi il carrello",

      "hero.eyebrow": "Pizza fatta bene",
      "hero.title": "Il tuo momento caldo,<br />appena sfornato.",
      "hero.sub": "Scegli dal menu, personalizza la tua pizza e ricevila ancora fumante.",
      "hero.cta": "Scopri il menu",

      "menu.eyebrow": "Il menu",
      "menu.title": "Scegli la tua pizza",
      "menu.loading": "Caricamento menu...",
      "menu.error": "Impossibile caricare il menu. Riprova più tardi.",
      "menu.empty": "Il menu non è disponibile al momento.",
      "menu.noCategories": "Nessuna categoria disponibile.",
      "menu.defaultDesc": "Ingredienti freschi e impasto a lunga lievitazione.",
      "menu.add": "Aggiungi",
      "menu.remove": "Riduci",

      "info.eyebrow": "Info",
      "info.title": "Come funziona",
      "info.choose.title": "Scegli",
      "info.choose.desc": "Seleziona le tue pizze preferite dal menu e aggiungile al carrello.",
      "info.order.title": "Ordina",
      "info.order.desc": "Inserisci i tuoi dati e scegli ritiro o consegna a domicilio.",
      "info.enjoy.title": "Goditi",
      "info.enjoy.desc": "Ricevi la tua pizza ancora fumante, appena sfornata.",

      "footer.tagline": "Pizza fatta bene.",
      "footer.admin": "Area staff",

      "cart.title": "Il tuo ordine",
      "cart.empty": "Aggiungi una pizza per iniziare.",
      "cart.total": "Totale",
      "cart.checkout": "Procedi all'ordine",

      "checkout.title": "Completa l'ordine",
      "checkout.close": "Chiudi",
      "checkout.name": "Nome e cognome",
      "checkout.name.ph": "Mario Rossi",
      "checkout.phone": "Telefono",
      "checkout.phone.ph": "333 123 4567",
      "checkout.type": "Ritiro o consegna",
      "checkout.pickup": "Ritiro",
      "checkout.delivery": "Consegna",
      "checkout.slot": "Orario di preparazione",
      "checkout.slot.ph": "Seleziona un orario",
      "checkout.slot.full": "completo",
      "checkout.slot.spots": "posti",
      "checkout.slot.hintEmpty": "Aggiungi una pizza per scegliere l'orario.",
      "checkout.slot.hintSelected": "Orario selezionato per {count} {pizza}.",
      "checkout.slot.pizza": "pizza",
      "checkout.slot.pizzas": "pizze",
      "checkout.address": "Indirizzo di consegna",
      "checkout.address.street": "Indirizzo",
      "checkout.address.street.ph": "1234 W Orchard Hill Dr",
      "checkout.address.apt": "Appartamento / piano (facoltativo)",
      "checkout.address.apt.ph": "Apt 2B",
      "checkout.address.city": "Città",
      "checkout.address.city.ph": "Città",
      "checkout.address.state": "Stato / regione",
      "checkout.address.state.ph": "Stato / regione",
      "checkout.address.zip": "CAP / codice postale",
      "checkout.address.zip.ph": "Codice postale",
      "checkout.address.country": "Paese",
      "checkout.address.country.ph": "Paese",
      "checkout.address.attribution": "Offerto da",
      "checkout.address.apiKeyMissing": "I suggerimenti richiedono una chiave API Geoapify. Puoi inserire l'indirizzo manualmente.",
      "checkout.address.searching": "Ricerca indirizzi...",
      "checkout.address.noResults": "Nessun indirizzo corrispondente. Puoi inserirlo manualmente.",
      "checkout.address.searchError": "Suggerimenti temporaneamente non disponibili. Puoi inserire l'indirizzo manualmente.",
      "checkout.address.ready": "Dettagli dell'indirizzo inseriti.",
      "checkout.address.selected": "Indirizzo selezionato dalla mappa.",
      "checkout.notes": "Note per la cucina (opzionale)",
      "checkout.notes.ph": "Es. senza cipolla, ben cotta...",
      "checkout.submit": "Invia ordine",
      "checkout.submitting": "Invio in corso...",
      "checkout.err.incomplete": "Completa i dati richiesti.",
      "checkout.err.address": "Inserisci l'indirizzo e la città.",
      "checkout.err.slot": "Scegli un orario di preparazione.",
      "checkout.err.slotFull": "Questo orario non ha più abbastanza posti. Scegline un altro.",
      "checkout.err.setup": "È necessario aggiornare il database per completare l'ordine. Contattaci per inviare l'ordine.",
      "checkout.err.generic": "Non è stato possibile inviare l'ordine. Riprova.",

      "confirm.title": "Ordine ricevuto!",
      "confirm.text": "Grazie! Il tuo ordine è stato inviato alla cucina.",
      "confirm.codeLabel": "Il tuo codice di tracciamento",
      "confirm.note": "Conserva questo codice per ritirare o seguire il tuo ordine.",
      "confirm.close": "Perfetto",

      "admin.login.title": "Area staff",
      "admin.login.sub": "Accedi per gestire ordini, orari, magazzino e menu.",
      "admin.login.email": "Email",
      "admin.login.email.ph": "staff@vipizza.it",
      "admin.login.password": "Password",
      "admin.login.btn": "Accedi",
      "admin.login.signing": "Accesso in corso...",
      "admin.login.err.empty": "Inserisci email e password.",
      "admin.login.err.invalid": "Credenziali non valide. Riprova.",
      "admin.logout": "Esci",
      "admin.connecting": "Connessione...",
      "admin.connected": "Connesso",
      "admin.reconnecting": "Riconnessione...",

      "admin.tab.orders": "Ordini",
      "admin.tab.slots": "Orari",
      "admin.tab.inventory": "Magazzino",
      "admin.tab.menu": "Menu",
      "admin.tab.content": "Testi del sito",
      "admin.tab.analytics": "Analisi",
      "admin.analytics.eyebrow": "Attività",
      "admin.analytics.title": "Vendite settimanali",
      "admin.analytics.period": "Ultime 12 settimane: {start} – {end}",
      "admin.analytics.refresh": "Aggiorna",
      "admin.analytics.cost": "Costo ingredienti",
      "admin.analytics.gain": "Guadagno",
      "admin.analytics.pizzas": "Pizze vendute",
      "admin.analytics.week": "Settimana del",
      "admin.analytics.legend": "Legenda del grafico",
      "admin.analytics.chartAria": "Grafico settimanale di costo ingredienti, guadagno e pizze vendute. I valori esatti sono nella tabella sottostante.",
      "admin.analytics.countNote": "Il conteggio include tutti gli ordini non annullati.",
      "admin.analytics.estimateNote": "Per gli ordini precedenti al salvataggio dei costi, vengono stimati i costi e i guadagni attuali del menu.",
      "admin.analytics.loadError": "Impossibile caricare i dati delle vendite settimanali.",
      "admin.content.eyebrow": "Sito web",
      "admin.content.title": "Testi del sito",
      "admin.content.description": "Modifica titoli e messaggi visibili ai clienti. Lascia un campo vuoto per usare il testo predefinito. I clienti vedranno le modifiche alla prossima visita.",
      "admin.content.languages": "Lingua dei contenuti",
      "admin.content.save": "Salva e pubblica",
      "admin.content.saved": "Testi del sito pubblicati.",
      "admin.content.loadError": "Impossibile caricare i testi del sito.",
      "admin.content.saveError": "Impossibile pubblicare le modifiche. Riprova.",
      "admin.content.unknownError": "Errore sconosciuto.",
      "admin.content.groupHero": "Hero",
      "admin.content.groupMenu": "Sezione menu",
      "admin.content.groupInfo": "Come funziona",
      "admin.content.groupFooter": "Piè di pagina",
      "admin.content.heroEyebrow": "Breve introduzione",
      "admin.content.heroTitle": "Titolo principale",
      "admin.content.heroSub": "Messaggio di supporto",
      "admin.content.heroCta": "Pulsante principale",
      "admin.content.menuEyebrow": "Introduzione al menu",
      "admin.content.menuTitle": "Titolo del menu",
      "admin.content.infoEyebrow": "Introduzione alle informazioni",
      "admin.content.infoTitle": "Titolo delle informazioni",
      "admin.content.chooseTitle": "Titolo Scegli",
      "admin.content.chooseDesc": "Testo Scegli",
      "admin.content.orderTitle": "Titolo Ordina",
      "admin.content.orderDesc": "Testo Ordina",
      "admin.content.enjoyTitle": "Titolo Gusta",
      "admin.content.enjoyDesc": "Testo Gusta",
      "admin.content.footerTagline": "Slogan a piè di pagina",

      "admin.orders.eyebrow": "Comande",
      "admin.orders.title": "Ordini in coda",
      "admin.orders.active": "attivi",
      "admin.orders.today": "oggi",
      "admin.orders.empty": "Nessun ordine. In attesa di nuove comande...",
      "admin.orders.delivery": "Consegna",
      "admin.orders.pickup": "Ritiro",
      "admin.orders.total": "Totale:",
      "admin.orders.advance": "→ {next}",
      "admin.orders.cancel": "Annulla",
      "admin.orders.cancelConfirm": "Annullare questo ordine?",
      "admin.orders.newOrder": "Nuovo ordine #{tracking}!",
      "admin.orders.loadError": "Impossibile caricare gli ordini.",

      "admin.slots.eyebrow": "Orari",
      "admin.slots.title": "Slot di ritiro",
      "admin.slots.add": "+ Nuovo slot",
      "admin.slots.empty": "Nessuno slot configurato.",
      "admin.slots.active": "Attivo",
      "admin.slots.inactive": "Disattivo",
      "admin.slots.capacity": "{reserved} / {max} pizze riservate · {remaining} liberi",
      "admin.slots.toggleOn": "Disattiva",
      "admin.slots.toggleOff": "Attiva",
      "admin.slots.edit": "Modifica",
      "admin.slots.delete": "Elimina",
      "admin.slots.deleteConfirm": "Eliminare questo slot?",
      "admin.slots.deleted": "Slot eliminato.",
      "admin.slots.loadError": "Impossibile caricare gli slot.",

      "admin.inv.eyebrow": "Magazzino",
      "admin.inv.title": "Inventario",
      "admin.inv.add": "+ Nuovo articolo",
      "admin.inv.empty": "Nessun articolo in magazzino.",
      "admin.inv.low": "Scorte basse",
      "admin.inv.ok": "OK",
      "admin.inv.threshold": "Soglia minima: {value} {unit}",
      "admin.inv.stockValue": "Valore delle scorte attuali",
      "admin.inv.unitCost": "Costo: {price} / {unit}",
      "admin.inv.itemValue": "Valore scorte: {value}",
      "admin.inv.edit": "Modifica",
      "admin.inv.delete": "Elimina",
      "admin.inv.deleteConfirm": "Eliminare questo articolo?",
      "admin.inv.deleted": "Articolo eliminato.",
      "admin.inv.loadError": "Impossibile caricare l'inventario.",
      "admin.inv.inUseError": "Questo ingrediente è usato in una ricetta e non può essere eliminato.",

      "admin.menu.eyebrow": "Menu",
      "admin.menu.title": "Gestione menu",
      "admin.menu.add": "+ Nuova pizza",
      "admin.menu.empty": "Nessun articolo nel menu.",
      "admin.menu.available": "Disponibile",
      "admin.menu.unavailable": "Non disponibile",
      "admin.menu.hide": "Nascondi",
      "admin.menu.show": "Mostra",
      "admin.menu.edit": "Modifica",
      "admin.menu.delete": "Elimina",
      "admin.menu.deleteConfirm": "Eliminare questo articolo dal menu?",
      "admin.menu.deleted": "Articolo eliminato.",
      "admin.menu.loadError": "Impossibile caricare il menu.",
      "admin.menu.costBreakdown": "Ingredienti: {cost} · Guadagno: {gain}",

      "admin.editor.title": "Modifica",
      "admin.editor.close": "Chiudi",
      "admin.editor.save": "Salva",
      "admin.editor.saved": "Salvato.",
      "admin.editor.error": "Impossibile salvare. Controlla i dati e riprova.",
      "admin.editor.slot.new": "Nuovo slot",
      "admin.editor.slot.edit": "Modifica slot",
      "admin.editor.slot.time": "Orario (HH:MM)",
      "admin.editor.slot.capacity": "Capacità (pizze)",
      "admin.editor.slot.reserved": "Riservate",
      "admin.editor.slot.active": "Attivo",
      "admin.editor.slot.yes": "Sì",
      "admin.editor.slot.no": "No",
      "admin.editor.inv.new": "Nuovo articolo",
      "admin.editor.inv.edit": "Modifica articolo",
      "admin.editor.inv.name": "Nome",
      "admin.editor.inv.unit": "Unità",
      "admin.editor.inv.qty": "Quantità",
      "admin.editor.inv.unitCost": "Costo per unità ($)",
      "admin.editor.inv.unitCostHint": "Costo per {unit} in magazzino.",
      "admin.editor.inv.threshold": "Soglia minima",
      "admin.editor.menu.new": "Nuova pizza",
      "admin.editor.menu.edit": "Modifica articolo",
      "admin.editor.menu.name": "Nome",
      "admin.editor.menu.category": "Categoria",
      "admin.editor.menu.desc": "Descrizione",
      "admin.editor.menu.price": "Prezzo finale ($)",
      "admin.editor.menu.ingredientCost": "Costo ingredienti per pizza",
      "admin.editor.menu.gain": "Guadagno per pizza ($)",
      "admin.editor.menu.finalPrice": "Prezzo pizza (costo + guadagno)",
      "admin.editor.menu.available": "Disponibile",
      "admin.editor.menu.ingredients": "Ingredienti per pizza",
      "admin.editor.menu.addIngredient": "Aggiungi ingrediente",
      "admin.editor.menu.ingredient": "Ingrediente",
      "admin.editor.menu.chooseIngredient": "Scegli ingrediente",
      "admin.editor.menu.ingredientQuantity": "Quantità per pizza",
      "admin.editor.menu.removeIngredient": "Rimuovi ingrediente",
      "admin.editor.menu.ingredientError": "Scegli ogni ingrediente una sola volta e inserisci una quantità maggiore di zero.",
      "admin.editor.menu.photo": "Foto JPEG",
      "admin.editor.menu.photoHint": "Solo JPEG, massimo 5 MB.",
      "admin.editor.menu.photoError": "Scegli una foto JPEG fino a 5 MB."
    },

    es: {
      "nav.menu": "Menú",
      "nav.info": "Info",
      "nav.admin": "Área de personal",
      "cart.open": "Abrir carrito",
      "cart.close": "Cerrar carrito",

      "hero.eyebrow": "Pizza bien hecha",
      "hero.title": "Tu momento caliente,<br />recién salido del horno.",
      "hero.sub": "Elige del menú, personaliza tu pizza y recíbela aún humeante.",
      "hero.cta": "Explorar el menú",

      "menu.eyebrow": "El menú",
      "menu.title": "Elige tu pizza",
      "menu.loading": "Cargando menú...",
      "menu.error": "No se pudo cargar el menú. Inténtalo de nuevo.",
      "menu.empty": "El menú no está disponible en este momento.",
      "menu.noCategories": "No hay categorías disponibles.",
      "menu.defaultDesc": "Ingredientes frescos y masa de fermentación larga.",
      "menu.add": "Añadir",
      "menu.remove": "Quitar",

      "info.eyebrow": "Info",
      "info.title": "Cómo funciona",
      "info.choose.title": "Elige",
      "info.choose.desc": "Selecciona tus pizzas favoritas del menú y añádelas al carrito.",
      "info.order.title": "Pide",
      "info.order.desc": "Introduce tus datos y elige recogida o entrega a domicilio.",
      "info.enjoy.title": "Disfruta",
      "info.enjoy.desc": "Recibe tu pizza aún humeante, recién salida del horno.",

      "footer.tagline": "Pizza bien hecha.",
      "footer.admin": "Área de personal",

      "cart.title": "Tu pedido",
      "cart.empty": "Añade una pizza para empezar.",
      "cart.total": "Total",
      "cart.checkout": "Continuar con el pedido",

      "checkout.title": "Completa tu pedido",
      "checkout.close": "Cerrar",
      "checkout.name": "Nombre y apellidos",
      "checkout.name.ph": "Mario Rossi",
      "checkout.phone": "Teléfono",
      "checkout.phone.ph": "333 123 4567",
      "checkout.type": "Recogida o entrega",
      "checkout.pickup": "Recogida",
      "checkout.delivery": "Entrega",
      "checkout.slot": "Hora de preparación",
      "checkout.slot.ph": "Selecciona una hora",
      "checkout.slot.full": "completo",
      "checkout.slot.spots": "plazas",
      "checkout.slot.hintEmpty": "Añade una pizza para elegir una hora.",
      "checkout.slot.hintSelected": "Hora seleccionada para {count} {pizza}.",
      "checkout.slot.pizza": "pizza",
      "checkout.slot.pizzas": "pizzas",
      "checkout.address": "Dirección de entrega",
      "checkout.address.street": "Dirección",
      "checkout.address.street.ph": "1234 W Orchard Hill Dr",
      "checkout.address.apt": "Apartamento / piso (opcional)",
      "checkout.address.apt.ph": "Apt 2B",
      "checkout.address.city": "Ciudad",
      "checkout.address.city.ph": "Ciudad",
      "checkout.address.state": "Estado / región",
      "checkout.address.state.ph": "Estado / región",
      "checkout.address.zip": "ZIP / código postal",
      "checkout.address.zip.ph": "Código postal",
      "checkout.address.country": "País",
      "checkout.address.country.ph": "País",
      "checkout.address.attribution": "Ofrecido por",
      "checkout.address.apiKeyMissing": "Las sugerencias requieren una clave API de Geoapify. Puedes introducir la dirección manualmente.",
      "checkout.address.searching": "Buscando direcciones...",
      "checkout.address.noResults": "No se encontraron direcciones coincidentes. Puedes introducirla manualmente.",
      "checkout.address.searchError": "Las sugerencias no están disponibles temporalmente. Puedes introducir la dirección manualmente.",
      "checkout.address.ready": "Detalles de dirección introducidos.",
      "checkout.address.selected": "Dirección seleccionada del mapa.",
      "checkout.notes": "Notas para la cocina (opcional)",
      "checkout.notes.ph": "Ej. sin cebolla, bien hecha...",
      "checkout.submit": "Enviar pedido",
      "checkout.submitting": "Enviando...",
      "checkout.err.incomplete": "Completa los campos obligatorios.",
      "checkout.err.address": "Introduce la dirección y la ciudad.",
      "checkout.err.slot": "Elige una hora de preparación.",
      "checkout.err.slotFull": "Esta hora no tiene más plazas. Elige otra.",
      "checkout.err.setup": "Se necesita actualizar la base de datos para completar el pedido. Contáctanos para realizarlo.",
      "checkout.err.generic": "No se pudo enviar el pedido. Inténtalo de nuevo.",

      "confirm.title": "¡Pedido recibido!",
      "confirm.text": "¡Gracias! Tu pedido se ha enviado a la cocina.",
      "confirm.codeLabel": "Tu código de seguimiento",
      "confirm.note": "Guarda este código para recoger o seguir tu pedido.",
      "confirm.close": "Perfecto",

      "admin.login.title": "Área de personal",
      "admin.login.sub": "Inicia sesión para gestionar pedidos, horarios, inventario y menú.",
      "admin.login.email": "Correo electrónico",
      "admin.login.email.ph": "staff@vipizza.it",
      "admin.login.password": "Contraseña",
      "admin.login.btn": "Iniciar sesión",
      "admin.login.signing": "Iniciando sesión...",
      "admin.login.err.empty": "Introduce correo y contraseña.",
      "admin.login.err.invalid": "Credenciales no válidas. Inténtalo de nuevo.",
      "admin.logout": "Salir",
      "admin.connecting": "Conectando...",
      "admin.connected": "Conectado",
      "admin.reconnecting": "Reconectando...",

      "admin.tab.orders": "Pedidos",
      "admin.tab.slots": "Horarios",
      "admin.tab.inventory": "Inventario",
      "admin.tab.menu": "Menú",
      "admin.tab.content": "Textos del sitio",
      "admin.tab.analytics": "Estadísticas",
      "admin.analytics.eyebrow": "Negocio",
      "admin.analytics.title": "Ventas semanales",
      "admin.analytics.period": "Últimas 12 semanas: {start} – {end}",
      "admin.analytics.refresh": "Actualizar",
      "admin.analytics.cost": "Coste de ingredientes",
      "admin.analytics.gain": "Ganancia",
      "admin.analytics.pizzas": "Pizzas vendidas",
      "admin.analytics.week": "Semana del",
      "admin.analytics.legend": "Leyenda del gráfico",
      "admin.analytics.chartAria": "Gráfico semanal del coste de ingredientes, la ganancia y las pizzas vendidas. La tabla inferior muestra los valores exactos.",
      "admin.analytics.countNote": "El recuento incluye todos los pedidos no cancelados.",
      "admin.analytics.estimateNote": "Los pedidos anteriores al registro de costes usan estimaciones basadas en los costes y ganancias actuales del menú.",
      "admin.analytics.loadError": "No se pudieron cargar los datos de ventas semanales.",
      "admin.content.eyebrow": "Sitio web",
      "admin.content.title": "Textos del sitio",
      "admin.content.description": "Edita títulos y mensajes visibles para los clientes. Deja un campo vacío para usar el texto predeterminado. Los clientes verán los cambios en su próxima visita.",
      "admin.content.languages": "Idioma del contenido",
      "admin.content.save": "Guardar y publicar",
      "admin.content.saved": "Textos del sitio publicados.",
      "admin.content.loadError": "No se pudieron cargar los textos del sitio.",
      "admin.content.saveError": "No se pudieron publicar los cambios. Inténtalo de nuevo.",
      "admin.content.unknownError": "Error desconocido.",
      "admin.content.groupHero": "Portada",
      "admin.content.groupMenu": "Sección del menú",
      "admin.content.groupInfo": "Cómo funciona",
      "admin.content.groupFooter": "Pie de página",
      "admin.content.heroEyebrow": "Introducción breve",
      "admin.content.heroTitle": "Título principal",
      "admin.content.heroSub": "Mensaje de apoyo",
      "admin.content.heroCta": "Botón principal",
      "admin.content.menuEyebrow": "Introducción al menú",
      "admin.content.menuTitle": "Título del menú",
      "admin.content.infoEyebrow": "Introducción informativa",
      "admin.content.infoTitle": "Título informativo",
      "admin.content.chooseTitle": "Título Elige",
      "admin.content.chooseDesc": "Texto Elige",
      "admin.content.orderTitle": "Título Pide",
      "admin.content.orderDesc": "Texto Pide",
      "admin.content.enjoyTitle": "Título Disfruta",
      "admin.content.enjoyDesc": "Texto Disfruta",
      "admin.content.footerTagline": "Lema del pie de página",

      "admin.orders.eyebrow": "Pedidos",
      "admin.orders.title": "Pedidos en cola",
      "admin.orders.active": "activos",
      "admin.orders.today": "hoy",
      "admin.orders.empty": "Sin pedidos. Esperando nuevas comandas...",
      "admin.orders.delivery": "Entrega",
      "admin.orders.pickup": "Recogida",
      "admin.orders.total": "Total:",
      "admin.orders.advance": "→ {next}",
      "admin.orders.cancel": "Cancelar",
      "admin.orders.cancelConfirm": "¿Cancelar este pedido?",
      "admin.orders.newOrder": "¡Nuevo pedido #{tracking}!",
      "admin.orders.loadError": "No se pudieron cargar los pedidos.",

      "admin.slots.eyebrow": "Horarios",
      "admin.slots.title": "Franjas de recogida",
      "admin.slots.add": "+ Nueva franja",
      "admin.slots.empty": "No hay franjas configuradas.",
      "admin.slots.active": "Activo",
      "admin.slots.inactive": "Inactivo",
      "admin.slots.capacity": "{reserved} / {max} pizzas reservadas · {remaining} libres",
      "admin.slots.toggleOn": "Desactivar",
      "admin.slots.toggleOff": "Activar",
      "admin.slots.edit": "Editar",
      "admin.slots.delete": "Eliminar",
      "admin.slots.deleteConfirm": "¿Eliminar esta franja?",
      "admin.slots.deleted": "Franja eliminada.",
      "admin.slots.loadError": "No se pudieron cargar las franjas.",

      "admin.inv.eyebrow": "Inventario",
      "admin.inv.title": "Inventario",
      "admin.inv.add": "+ Nuevo artículo",
      "admin.inv.empty": "No hay artículos en stock.",
      "admin.inv.low": "Stock bajo",
      "admin.inv.ok": "OK",
      "admin.inv.threshold": "Umbral mínimo: {value} {unit}",
      "admin.inv.stockValue": "Valor actual del inventario",
      "admin.inv.unitCost": "Coste: {price} / {unit}",
      "admin.inv.itemValue": "Valor en stock: {value}",
      "admin.inv.edit": "Editar",
      "admin.inv.delete": "Eliminar",
      "admin.inv.deleteConfirm": "¿Eliminar este artículo?",
      "admin.inv.deleted": "Artículo eliminado.",
      "admin.inv.loadError": "No se pudo cargar el inventario.",
      "admin.inv.inUseError": "Este ingrediente se usa en una receta y no se puede eliminar.",

      "admin.menu.eyebrow": "Menú",
      "admin.menu.title": "Gestión del menú",
      "admin.menu.add": "+ Nueva pizza",
      "admin.menu.empty": "No hay artículos en el menú.",
      "admin.menu.available": "Disponible",
      "admin.menu.unavailable": "No disponible",
      "admin.menu.hide": "Ocultar",
      "admin.menu.show": "Mostrar",
      "admin.menu.edit": "Editar",
      "admin.menu.delete": "Eliminar",
      "admin.menu.deleteConfirm": "¿Eliminar este artículo del menú?",
      "admin.menu.deleted": "Artículo eliminado.",
      "admin.menu.loadError": "No se pudo cargar el menú.",
      "admin.menu.costBreakdown": "Ingredientes: {cost} · Ganancia: {gain}",

      "admin.editor.title": "Editar",
      "admin.editor.close": "Cerrar",
      "admin.editor.save": "Guardar",
      "admin.editor.saved": "Guardado.",
      "admin.editor.error": "No se pudo guardar. Revisa los datos e inténtalo de nuevo.",
      "admin.editor.slot.new": "Nueva franja",
      "admin.editor.slot.edit": "Editar franja",
      "admin.editor.slot.time": "Hora (HH:MM)",
      "admin.editor.slot.capacity": "Capacidad (pizzas)",
      "admin.editor.slot.reserved": "Reservadas",
      "admin.editor.slot.active": "Activo",
      "admin.editor.slot.yes": "Sí",
      "admin.editor.slot.no": "No",
      "admin.editor.inv.new": "Nuevo artículo",
      "admin.editor.inv.edit": "Editar artículo",
      "admin.editor.inv.name": "Nombre",
      "admin.editor.inv.unit": "Unidad",
      "admin.editor.inv.qty": "Cantidad",
      "admin.editor.inv.unitCost": "Coste por unidad ($)",
      "admin.editor.inv.unitCostHint": "Coste por {unit} en inventario.",
      "admin.editor.inv.threshold": "Umbral mínimo",
      "admin.editor.menu.new": "Nueva pizza",
      "admin.editor.menu.edit": "Editar artículo",
      "admin.editor.menu.name": "Nombre",
      "admin.editor.menu.category": "Categoría",
      "admin.editor.menu.desc": "Descripción",
      "admin.editor.menu.price": "Precio final ($)",
      "admin.editor.menu.ingredientCost": "Coste de ingredientes por pizza",
      "admin.editor.menu.gain": "Ganancia por pizza ($)",
      "admin.editor.menu.finalPrice": "Precio de pizza (coste + ganancia)",
      "admin.editor.menu.available": "Disponible",
      "admin.editor.menu.ingredients": "Ingredientes por pizza",
      "admin.editor.menu.addIngredient": "Añadir ingrediente",
      "admin.editor.menu.ingredient": "Ingrediente",
      "admin.editor.menu.chooseIngredient": "Elegir ingrediente",
      "admin.editor.menu.ingredientQuantity": "Cantidad por pizza",
      "admin.editor.menu.removeIngredient": "Quitar ingrediente",
      "admin.editor.menu.ingredientError": "Elige cada ingrediente una sola vez e indica una cantidad mayor que cero.",
      "admin.editor.menu.photo": "Foto JPEG",
      "admin.editor.menu.photoHint": "Solo JPEG, hasta 5 MB.",
      "admin.editor.menu.photoError": "Elige una foto JPEG de hasta 5 MB."
    }
  };

  // ---------------------------------------------------------------------------
  // i18n engine
  // ---------------------------------------------------------------------------
  let currentLang = loadLang();
  let contentOverrides = {};

  function loadLang() {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved && translations[saved]) return saved;
    } catch {
      // ignore
    }
    return DEFAULT_LANG;
  }

  function saveLang(lang) {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      // ignore
    }
  }

  /** Get a translated string, with optional {placeholder} substitution. */
  function t(key, vars) {
    let str = contentOverrides[currentLang]?.[key] ?? translations[currentLang][key] ?? translations[DEFAULT_LANG][key] ?? key;
    if (vars) {
      Object.keys(vars).forEach((k) => {
        str = str.replace(`{${k}}`, String(vars[k]));
      });
    }
    return str;
  }

  /** Apply translations to all elements marked with data-i18n attributes. */
  function applyToDom() {
    document.documentElement.setAttribute("lang", currentLang);

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    // For strings that contain markup (e.g. <br />), use innerHTML.
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const key = el.dataset.i18nHtml;
      const override = contentOverrides[currentLang]?.[key];
      if (override !== undefined) {
        el.textContent = override;
        el.style.whiteSpace = "pre-line";
      } else {
        el.innerHTML = t(key);
        el.style.whiteSpace = "";
      }
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder));
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      el.setAttribute("aria-label", t(el.dataset.i18nAria));
    });

    // Update the language switcher active state.
    document.querySelectorAll("[data-lang]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.lang === currentLang);
      btn.setAttribute("aria-pressed", btn.dataset.lang === currentLang ? "true" : "false");
    });
  }

  /** Switch language, persist it, and re-render. */
  function setLang(lang) {
    if (!translations[lang]) lang = DEFAULT_LANG;
    currentLang = lang;
    saveLang(lang);
    applyToDom();
    // Notify other modules (storefront/admin) to re-render dynamic content.
    document.dispatchEvent(new CustomEvent("vipizza:langchange", { detail: lang }));
  }

  function getLang() {
    return currentLang;
  }

  function isDefault() {
    return currentLang === DEFAULT_LANG;
  }

  function setContentOverrides(entries) {
    const next = {};
    (entries || []).forEach(({ key, language, content }) => {
      if (!translations[language] || typeof key !== "string" || typeof content !== "string") return;
      next[language] = next[language] || {};
      next[language][key] = content;
    });
    contentOverrides = next;
    applyToDom();
  }

  function getBaseText(key, language) {
    return translations[language]?.[key] ?? translations[DEFAULT_LANG][key] ?? "";
  }

  // Expose API.
  const VIPizza = (window.VIPizza = window.VIPizza || {});
  VIPizza.i18n = { t, setLang, getLang, isDefault, applyToDom, setContentOverrides, getBaseText, FLAGS, LANG_NAMES, DEFAULT_LANG };

  // Build the language switcher UI (shared by both pages).
  function buildSwitcher() {
    const container = document.getElementById("lang-switcher");
    if (!container) return;
    container.innerHTML = "";
    Object.keys(translations).forEach((code) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lang-btn";
      btn.dataset.lang = code;
      btn.setAttribute("aria-label", LANG_NAMES[code]);
      btn.setAttribute("aria-pressed", code === currentLang ? "true" : "false");
      btn.title = LANG_NAMES[code];
      btn.innerHTML = `<span class="lang-flag" aria-hidden="true">${FLAGS[code]}</span><span class="lang-code">${code.toUpperCase()}</span>`;
      btn.addEventListener("click", () => setLang(code));
      container.appendChild(btn);
    });
    applyToDom();
  }

  // Initialize once the DOM is ready.
  function init() {
    buildSwitcher();
    applyToDom();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();