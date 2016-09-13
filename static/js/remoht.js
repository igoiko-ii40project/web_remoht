/*
 *
 *
*/


var remoht = {
	init : function() {
	
		if (sessionStorage.getItem("element") != null)
		{	
			sessionStorage.removeItem("element");
			remoht.inicializa_datos_indice();
			//sessionStorage.removeItem("device");
		}
		$(document)
	   .ajaxStart( function(e) { $('.spinner').fadeIn() })
		 .ajaxStop(  function(e) { $('.spinner').fadeOut() })
		
		if ( remoht.logged_in ) {
			remoht.get_devices()
			remoht.open_channel()
			remoht.get_resources()
		}

		$('#resources-refresh').bind('click',function(e) {
			e.preventDefault()
			remoht.get_resources()
		})

		remoht.setup_chart()
		if ( ! remoht.logged_in ) remoht.start_demo()
		
		
	},
	logged_in : false,
	resource_logged_in : "", 	/*name of the resource logged in for monitoring under that user*/
	/* Resources are the list of available JID resources to choose from.
	 * Not all of them will be devices (TODO we should look for a specific
	 * pattern, e.g. "remoht_device1" or something similar.)
	 */
	resources : {},

	get_resources : function() {
		$.ajax('/resources/', {
			success : function(data,stat,xhr) {
				remoht.resources = data.resources    /*from the resources associated to that jid*/
				// clear list
				$('#resource_list li').each( function(i,item) {				/*clear bottom box: all resources per xmpp*/
					if (i == 0) return
					$(item).remove() // clear list except for header
				})
				// iterating over a dict of resource:presence items
				for ( i in data.resources ) {
					remoht.add_resource(i, data.resources[i] )
				}
			}
		})
	},

	add_resource : function(resource,presence) {
		var element = ich.resource_line({resource:resource,presence:presence})
					
		remoht.toggle_presence(element, presence)
		
		$('#resource_list').append(element) 							/*populate bottom box: all resources per xmpp*/

		element.bind('click', function(e) {
			var currentdate = new Date();
			var datetime_stamp = "[" +currentdate.getHours() + ":"
							+ currentdate.getMinutes() + ":"
							+ currentdate.getSeconds()+"]: ";

			e.preventDefault()
			$.ajax('/device/', {
				type : "POST",
				data : {resource:resource},
				success : function(data,stat,xhr) {
					console.debug(datetime_stamp+"Created device!", data.device)
					// TODO ensure it doesn't already exist.
					remoht.add_device_to_list( data.device )
				}
			})
		})
	},

	show_ind_elems : function(resource,presence) {
		var element = ich.resource_line({resource:resource,presence:presence})

		$('#ind_elem_list').append(element)

		/*element.bind('click', function(e) {
			e.preventDefault()
			$.ajax('/device/', {
				type : "POST",
				data : {resource:resource},
				success : function(data,stat,xhr) {
					console.debug("Created device!", data.device)
					// TODO ensure it doesn't already exist.
				}
			})
		})
		*/
	},


	/* Devices are essentially resources that have been chosen as beloning
	 * to an actual RPi, so we should expect to see readings & responses
	 * when it is selected.
	 */
	get_devices : function() {
		$.ajax('/device/', {
			success: function(data,stat,xhr) {
				$('#device_list').find('li').each(function(i,item) {
					item = $(item)
					if ( ! item.hasClass('nav-header') ) item.remove() 
				})
				for( i in data.devices ) {
					remoht.add_device_to_list( data.devices[i] )
				}
			}
		})
	},

	add_device_to_list : function(device) {
		var element = ich.device_line(device)
      
		remoht.toggle_presence(element, device.presence)

		$('#device_list').append(element)

		element.bind('click',function(e) {
			e.preventDefault()

			old_logged_in_resource=remoht.resource_logged_in
			new_logged_in_resource=device.resource
			remoht.current_device_id = device.id

			var currentdate = new Date();
			var datetime_stamp = "[" +currentdate.getHours() + ":"
							+ currentdate.getMinutes() + ":"
							+ currentdate.getSeconds()+"]: ";
			if (new_logged_in_resource != old_logged_in_resource){

				remoht.resource_logged_in=new_logged_in_resource
				sessionStorage.setItem("logged", remoht.resource_logged_in);
				console.debug(datetime_stamp+"new current logged in resource is: ", remoht.resource_logged_in)
				console.debug(datetime_stamp+"going to jump to log_to_device... ")
				$('#full_JID').text("")
				$('#current_date').text("")
				$('#temp').text("")
				$('#light').text("")
//				remoht.setup_chart.context.stop()
//				TODO: reset the chart when the resource is changed
				remoht.log_to_device(device.id)
			}
			else{
				remoht.resource_logged_in=new_logged_in_resource
				console.debug(datetime_stamp+"logged in resource not changed. current logged in resource is: ", remoht.resource_logged_in)
				remoht.get_relays(device.id)
			}
			
			/* IRD 04/09/2015 Almacenamos el usuario de conexion */ 			
			sessionStorage.setItem("devicejid", device.jid);
			/* FIN IRD 04/09/2015 */
			$('#device_header .device_name').text(device.jid+'/'+remoht.resource_logged_in)

//i want to send the auth login to new device, so that it responds and sends its structure, to be represented


		})
	},

	toggle_presence : function(elem,presence) {
		
		if (sessionStorage.getItem("element"))
			{
				console.debug("pasar")
				return	
			}
		if ( ! elem ) return
		if ( presence == 'available' ) {
			elem.find('.label-important').hide()
			elem.find('.label-success').show()
		}
		else {
			elem.find('.label-important').show()
			elem.find('.label-success').hide()
		}
	},
	
	get_relays : function(device_id) {
		$.ajax('/device/'+device_id+"/relay/", {
			success : function(data,stat,xhr) { 
				var currentdate = new Date();
				var datetime_stamp = "[" +currentdate.getHours() + ":"
								+ currentdate.getMinutes() + ":"
								+ currentdate.getSeconds()+"]: ";

				console.debug(datetime_stamp+"sth with relays!", data.relays)
				remoht.show_relays(device_id, data.relays)

			}
		})
	},

	show_relays: function(device_id, relays) {
		var currentdate = new Date();
		var datetime_stamp = "[" +currentdate.getHours() + ":"
						+ currentdate.getMinutes() + ":"
						+ currentdate.getSeconds()+"]: ";

		console.debug(datetime_stamp+"Show relays!", relays)
		var target_list = $('#relay_list').text('') // clear the existing content
		var target_list_cmd = $('#cmd_list').text('') // clear the existing content

		for( key in relays ) {
			console.debug(datetime_stamp+" in for loop for relay:", key)

			var relay_button = app.n('a', {
					href : '/device/'+device_id+'/relay/'+key,
					'class' : 'btn btn-large' }, 
				key )

			var state = relays[key]
			if ( state ) relay_button.addClass('btn-primary')
			else relay_button.removeClass('btn-primary')

			key_in=key
			state_in=state
			console.debug(datetime_stamp+"key_in  & state_in :", key_in, state_in)

			relay_button.on( 'click', {key_:key_in,state_:state_in},function(e) {
				e.preventDefault()
		        var data=e.data
		        console.debug(datetime_stamp+"Relay clicked!!: ", data.key_, data.state_)
				remoht.toggle_relay(device_id, data.key_, data.state_)
			})

            if (key=='relay_1'){
                key_in=1
                Btn_caption="Get Code"
			}
            if (key=='relay_2'){
                key_in=2
                Btn_caption="Get Cred"
			}
            state_in=state

            //I use also to update the cmd commands (i accept in this implementation same # of cms as relays)
			var cmd_button = app.n('a', {
					href : '/device/'+device_id+'/funs/'+key_in,
					'class' : 'btn btn-large' },
				Btn_caption )
			cmd_button.addClass('btn-primary')

			console.debug(datetime_stamp+"cmd: key_in  & state_in :", key_in, state_in)

			cmd_button.on( 'click', {cmd_:key_in,state_:state_in},function(e) {
				e.preventDefault()
		        var data=e.data
		        console.debug(datetime_stamp+"cmd clicked!!: ", data.cmd_, data.state_)
				remoht.get_cmd(device_id, data.cmd_, data.state_)
			})



			target_list.append(relay_button)
			target_list_cmd.append(cmd_button)
		}
	},

	toggle_relay : function(device_id, relay, fromState) {
		var currentdate = new Date();
		var datetime_stamp = "[" +currentdate.getHours() + ":"
						+ currentdate.getMinutes() + ":"
						+ currentdate.getSeconds()+"]: ";
		console.debug(datetime_stamp+"Toggle relay!  (from)", relay, fromState)
		$.ajax('/device/'+device_id+"/relay/"+relay, {
			type : "POST",
			dataType : 'json',
			data : { state : fromState == 0 ? 1 : 0 },
			success : function(data,stat,xhr) {
				// wait for callback over socket
			}
		})
	},

	get_cmd : function(device_id, cmd, fromState) {
		var currentdate = new Date();
		var datetime_stamp = "[" +currentdate.getHours() + ":" + currentdate.getMinutes() + ":" + currentdate.getSeconds()+"]: ";
		console.debug(datetime_stamp+"CMD!  ", cmd)
		$.ajax('/device/'+device_id+"/funs/"+cmd, {
			type : "POST",
			dataType : 'json',
			data : { cmd_ : cmd },
			success : function(data,stat,xhr) {
				console.debug(datetime_stamp+"cmd sent! ", data.cmd_)
				// wait for callback over socket
			}
		})
	},

	log_to_device : function(device_id) {
		var currentdate = new Date();
		var datetime_stamp = "[" +currentdate.getHours() + ":"
						+ currentdate.getMinutes() + ":"
						+ currentdate.getSeconds()+"]: ";

		sessionStorage.setItem("device", device_id);
		console.debug(datetime_stamp+"Logging to device... ", device_id)
		$.ajax('/device/'+device_id+"/login/", {
			type : "POST",
			dataType : 'json',
			data : { device : device_id },
			success : function(data,stat,xhr) {
				console.debug(datetime_stamp+"Call to login page ok... ")
			}
		})
	},



	last_reading : {}, // gets populated from channel push

	cubism_source : function(context) {
		var source = {};
		source.metric = function(prop, title) {
			var metric = context.metric(function(start, stop, step, callback) {
				var vals = [function(e) { return e[prop] }(remoht.last_reading)]
				// callback expects this many elements, just duplicate the last val:
				var elements = (stop - start) / step
				for( var i=1; i<elements; i++ ) vals.push(vals[0])
				callback(null, vals)
			});
			metric.toString = function() { return title; }
			return metric
		}
		return source
	},

	setup_chart : function() {
		
		var context = cubism.context()
			.serverDelay(0) 
			.clientDelay(0)
			.step(2e4)							//resolution: 10 sec steps
			.size($('#chart').width()) // //number of pixels/points of charts TODO dynamically resize
//			.size(1920)

//		var graphite = context					//context.graphite: define a datasource for Graphite metrics
//			.graphite("http://example.com");

// 		CONTEXT is the big chart panel
//		HORIZON is each of the subcharts



		var chartHeight= 30
		var source = remoht.cubism_source(context)
		var temp = source.metric('temp_c', 'Temp °C')
		var light = source.metric('light_pct', 'Light')

		var horizonTemp = context.horizon()
			.height(chartHeight).mode("offset")
			.extent([5.0, 100.0])
			.colors(["#08519c","#3182bd","#bdd7e7","#6baed6"])
//			.colors(["#bae4b3","#74c476",'#79f17c',"#ca7eff","#ba57ff","#9a0aff"])

		var horizonLight = context.horizon()
			.height(chartHeight).mode("offset")
			.extent([5.0, 100.0])
			.colors(["#ea9611","#f3ba5f","#f3ba5f","#ea9611"])

		d3.select('#chart').call(function(div) {
			div.append("div").attr("class", "axis")
				.call( context.axis()
					.orient("top")
					.ticks(d3.time.minutes, 30)
					.tickSubdivide(5) )

			div.append("div").datum(temp)
				.attr("class", "horizon")
				.call(horizonTemp)

			div.append("div").datum(light)
				.attr("class", "horizon")
				.call(horizonLight)

			div.append("div")
				.attr("class", "rule")
				.call(context.rule()); 
		})

		context.on("focus", function(i) {
			d3.selectAll(".value").style(
				"right", i == null ? null : context.size() - i + "px");
		})
	},
	
		

    //------------------------------------------------------------------------------------------------------------
	// These commands should correspond to the XMPP commands sent from
	// a device - see handlers/xmpp.ChatHandler#post()
	channel_commands : {

		presence : function(params) {
			var currentdate = new Date();
			var datetime_stamp = "[" +currentdate.getHours() + ":"
							+ currentdate.getMinutes() + ":"
							+ currentdate.getSeconds()+"]: ";

			if (sessionStorage.getItem("element"))
			{
				console.debug(datetime_stamp+"salir")
				return
				
			}
			console.debug(datetime_stamp+"Presence!", params.full_resource, params)
			if ( remoht.resources[params.resource] == null )
				remoht.add_resource( params.resource, params.presence )
			remoht.resources[params.resource] = params.presence

			// update device & resources list
			remoht.toggle_presence(
					$('.resource.res-'+params.resource).parent(), 
					params.presence)

			$('#signed_JID').text(params.signed_jid)
//			$('#full_JID').text(params.full_resource)
		},

		// response from get_relays ajax request above
		get_relays : function(params) {
			var currentdate = new Date();
			var datetime_stamp = "[" +currentdate.getHours() + ":"
							+ currentdate.getMinutes() + ":"
							+ currentdate.getSeconds()+"]: ";

			console.debug(datetime_stamp +"processing the new relay data from channel!")
			remoht.show_relays(params.device_id, params.relays)
			// TODO hide spinner
		},

		ind_elem_data : function(params) {
		},

		relay_result : function(params) {
		},

		list_data_streams : function(params) {
		},

        //------------------------------------------------------------------------------------------------------------
		get_readings : function(params) {
			var currentdate = new Date();
			var datetime_stamp = "[" +currentdate.getHours() + ":"
							+ currentdate.getMinutes() + ":"
							+ currentdate.getSeconds()+"]: ";

			console.debug(datetime_stamp +"processing the new reading from channel!", params.datestamp_msg)
			
			/* Inicio IRD */
			//if (sessionStorage.getItem("element"))
			if (sessionStorage.getItem("device"))
			{
				//console.debug("entra")
				remoht.current_device_id = sessionStorage.getItem("device")	
				
				$('#device_header .device_name').text(sessionStorage.getItem("devicejid")+'/'+sessionStorage.getItem("logged"))
			}
			/* Fin IRD */
			
			if ( remoht.current_device_id != params.device_id ) {
				console.debug("%s is not current device. Get reading info not for this device, will not be shown. Current device is %s", params.device_id, remoht.current_device_id )
				return
			}
			
			params.light_pct = parseInt(params.light_pct)
			
			var ter = (Math.max( 0, Math.min(1, params.light_pct/ 100.0 + Math.random() ) )*50).toFixed(1);
			var cua = (Math.max( 0, Math.min(1, params.temp_c/ 100.0 + Math.random() ) )*50).toFixed(1);
			
			/* IRD 04/09/2015 Almacenamos los datos de la cabecera para poder recuperarlos en otras páginas */
			sessionStorage.setItem("jid", params.jid);
		    sessionStorage.setItem("datestamp", params.datestamp_data);
			sessionStorage.setItem("temp", params.temp_c);
			sessionStorage.setItem("light", params.light_pct);
			/* FIN IRD 04/09/2015 */
			
			$('#full_JID').text(params.jid)
			$('#signed_JID').text(params.signed_jid)
			$('#current_date').text(params.datestamp_data)
			$('#temp').text(params.temp_c)
			$('#light').text(params.light_pct)
			
			
			remoht.last_reading = params // store only the last value received. It becomes available also for the cubism chart. If the data is from another resource, it will not show
			//var item = { "nuevo"": ter};
			if (sessionStorage.getItem("element"))
			{
				 var tercero=1;	
                 var cuarto=1;	
				$("#chart").find('span').each(function() 
				{
				 			  
				  if ($(this).hasClass('title'))
				  {	 
																												 
				     if ($(this).text() == 'Tercero')
					{
						tercero=0;
					}
					if ($(this).text() == 'Cuarto')
					{
						cuarto=0;																							   
				    }
																													  
																											   
				   }
				})
				if (tercero==1) remoht.last_reading["nuevo"]=ter;
				if (cuarto==1) remoht.last_reading["nuevo2"]=cua;
			}
		
			
		},

        // Get Image------------------------------------------------------------------------------------------------------------
			get_image : function(params) 
			{
			var currentdate = new Date();
			var datetime_stamp = "[" +currentdate.getHours() + ":"
							+ currentdate.getMinutes() + ":"
							+ currentdate.getSeconds()+"]: ";

			console.debug(datetime_stamp +"processing the new device image from channel!", params.device_id)
			console.debug(sessionStorage.getItem("device"));
			if (sessionStorage.getItem("element")) // si estamos en la página de detalle
			{
		
				// actualizamos el dispositivo actual con el que hemos guardado
				remoht.current_device_id = sessionStorage.getItem("device")	 
			}
			
			if ( remoht.current_device_id != params.device_id ) {
				console.debug("%s is not current device. Get reading info not for this device, will not be shown. Current device is %s", params.device_id, remoht.current_device_id )
				return
			}
			
			// lo sacamos del if para que las imagenes que nos lleguen mientras estemos en la página
			// de detalle se guarden también a pesar de no tener que volver a pintar el arbol.
			// Asi nos aseguramos de tener la última imagen recibida siempre.
			
			sessionStorage.setItem("imagen", JSON.stringify(params.device_image));
            if (sessionStorage.getItem("element")==null)
			{
				console.log("página principal1");
			    return
			}
			else
			{
				console.log("página detalle " + sessionStorage.getItem("element"));
			
			
			var list_of_image_keys = $.map(params.device_image[sessionStorage.getItem("element")]["ind_element_subelements_json"], function(v, i){
			  return i;
			});
			console.debug("list of image keys ", list_of_image_keys);
			
			
			
			
			/* empieza prueba arbol*/
			var ul = document.getElementById("nivel_1");
			if (ul.innerHTML =="") // Si no hemos pintado el arbol
			{
				
			$('#nivel_1 li').each( function(i,item) 
			{
				if (i == 0) return
				$(item).remove() // clear list except for header
			})
			//alert("pinta arbol get image1");
			// Inicializamos la base del arbol
			ul.innerHTML = sessionStorage.getItem("element");
			var ul0= document.createElement("ul");
			ul.appendChild(ul0);
			// creamos dinamicamente el primer nivel que sale de la base 
			for( MBOX_item in list_of_image_keys )
			{
				var li = document.createElement("li");
			    li.setAttribute("id","nivel_1"+MBOX_item);
				li.setAttribute('onclick','$("#tab-nondiv-container").easytabs("select", "#nondiv-tab'+MBOX_item+'")');
				li.setAttribute("data-jstree","{ 'opened' : false }")
				li.innerHTML= list_of_image_keys[MBOX_item]
				ul0.appendChild(li);
				var ul2= document.createElement("ul");
				ul2.setAttribute("data-jstree","{ 'type' : 'default' }");
				li.appendChild(ul2);
				
				/* NUEVO CÓDIGO */
				
				//var list_of_image_keys3 = $.map(params.device_image["MACARBOX_FFG_ELEMENT"]["attributes"][list_of_image_keys[MBOX_item]]["attributes"], function(v, i){
				var list_of_image_keys3 = $.map(params.device_image[sessionStorage.getItem("element")]["ind_element_subelements_json"][list_of_image_keys[MBOX_item]]["ind_element_subelements_json"], function(v, i){
				return i;
				});
				console.debug("list of image keys 3 ", list_of_image_keys3)
				/* FIN NUEVO CODIGO */
				
				// creamos dinamicamente el segundo nivel que sale del primero 
				for( MBOX_item2 in list_of_image_keys3 ){
					
					    var li = document.createElement("li")
						li.setAttribute("id","nivel_1"+MBOX_item+"_"+MBOX_item2);
						li.setAttribute('data-jstree','{"type":"fichero" }');
						//li.setAttribute("class","jstree-file");
						var valor3 = list_of_image_keys3[MBOX_item2];
					
	                    
						var valor = params.device_image[sessionStorage.getItem("element")]["ind_element_subelements_json"][list_of_image_keys[MBOX_item]]["ind_element_subelements_json"][valor3];
						
						li.setAttribute('title',valor3);
						var inicio = valor3.substring(0,4);
						
						if (inicio =="ind_") // Si no tienen valor
						{
							li.innerHTML= valor3;
						}
						else // si son del tipo que si, debemos concatenarlo para que se muestre
						{
							var ans = ('---------------------------').substring(valor3.length);
						    li.innerHTML= valor3 + ans + valor;
						}
						ul2.appendChild(li);
				}
			}
			
			
		    // Convertimos la lista en un arbol de contenidos
			// Como parte de la librería jstree se le pueden incluir una serie de plugins
			// que permiten ciertas funcionalidades como busquedas dentro del arbol, iconos diferenciados,
			// submenus, etc,...
			
							$('#arbol').jstree({
								"types" : {
											"fichero" : { "icon" : "jstree-file"},
											"default" : {"icon" : "jstree-folder"}
										   },
								"plugins" : [ "types", "contextmenu"],
								"contextmenu": {
												"items": function ($node) {
													                        // identificamos el arbol del nodo seleccionado
																			var CurrentNode = $("#arbol").jstree("get_selected");
																			// Averiguamos si tiene el atributo "title"
																			var attr = $('#'+CurrentNode).attr('title');
																			// Si no lo tiene es un nodo de niveles superiores
																			// que no debe mostrar el menu contextual
																			if (!attr)
																			{
																				var tmp =[];
                                                                                return tmp;
																			}
																			// En caso contrario, es del últmo nivel y definimos las opciones del menu contextual 
																			else
																			{	
																			return {
																					Visualizar: {
																									label: "Gráfica",
																									action: function (node) 
																											{  
																											  // Obtenemos el nombre del elemento seleccionado
																											  var titulo = $('#'+CurrentNode).attr('title');
																											  // Obtenemos el valor del elemento seleccionado
																											  var valor = $('#'+CurrentNode).val(); 
																											    // Para cada una de las franjas de la gráfica
																											 	$("#chart").find('span').each(function() 
																												{
																											     if ($(this).hasClass('title'))
																												 {	 
																											        // Si la tercera franja todavía no ha sido asignada
																													if ($(this).text() == 'Tercero')
																													{
																													  // actualizamos la leyenda	
																													  $(this).text(titulo);
																													  // Salimos del bucle
																													  return false;
																													 }
																													 // Si la cuarta franja todavía no ha sido asignada
																												     else if ($(this).text() == 'Cuarto')
																													{
																													   // actualizamos la leyenda
																													   $(this).text(titulo);
																													    // Salimos del bucle
																													   return false;
																													 }
																												  }
																												})
																											}
																								},
																					Modificar: {
																								label: "Modificar"
																								}
																						};
																			}
																			}
												}
								});
			
			/*Fin Prueba arbol */
			/* Parte Pestañas */
			
			var contenedor = document.getElementById("containermio");
								
			var formulario = document.createElement("form");
			formulario.setAttribute("id","tab-nondiv-container");
			formulario.setAttribute("class","tab-container");
								
			contenedor.appendChild(formulario);
								
		    ul = document.createElement("ul");
			ul.setAttribute("class","etabs");
								
			division = document.createElement("div");
			division.setAttribute("class","field-container");
			division.setAttribute("id","detalle");
								
								
			formulario.appendChild(ul);
		    formulario.appendChild(division);
								
		    for( MBOX_item in list_of_image_keys )
			{
				li = document.createElement("li");
				if (MBOX_item==0)
				{
					li.setAttribute("id","nondiv-default");
				}
				li.setAttribute("class","tab");
									
				ancla = document.createElement("a");
				ancla.textContent = list_of_image_keys[MBOX_item].substring(13);
				ancla.setAttribute("href", "#nondiv-tab"+MBOX_item);
									
				li.appendChild(ancla);
				ul.appendChild(li);
									
				campo = document.createElement("fieldset");
				campo.setAttribute("id","nondiv-tab"+MBOX_item);
									
				var list_of_image_keys3 = $.map(params.device_image[sessionStorage.getItem("element")]["ind_element_subelements_json"][list_of_image_keys[MBOX_item]]["ind_element_subelements_json"], function(v, i){
				return i;
				});
									console.debug("list of image keys 3 ", list_of_image_keys3)
									
									for( MBOX_item2 in list_of_image_keys3 )
									{
										
										 var valor3 = list_of_image_keys3[MBOX_item2];
				                         var valor = params.device_image[sessionStorage.getItem("element")]["ind_element_subelements_json"][list_of_image_keys[MBOX_item]]["ind_element_subelements_json"][valor3];
										
										grupo = document.createElement("div");
										 grupo.setAttribute("class","form-group");
										 
										 var etiqueta = document.createElement("label");
										 etiqueta.textContent=list_of_image_keys3[MBOX_item2];
										 etiqueta.setAttribute("for","inp_"+MBOX_item+"_"+MBOX_item2);
										
										 
										var caja= document.createElement("input");
									    caja.setAttribute("type","text");
										caja.setAttribute("id","inp_"+MBOX_item+"_"+MBOX_item2);
										caja.setAttribute("onchange", "$(this).addClass('cambiado')");
										
										var inicio = valor3.substring(0,4);
						
										if (inicio !="ind_")
										{	
											caja.setAttribute("value",valor);
										}
										else
										{
											caja.setAttribute("disabled", true);
										}
									   
										
										grupo.appendChild(etiqueta);
										grupo.appendChild(caja);
										
										campo.appendChild(grupo)
										
								    }
									 division.appendChild(campo);
									
									
								}
								
								$('#tab-nondiv-container').easytabs({tabs: ".etabs li"});
								
			
			
			
			} 
			} /*fin else*/
		},

        //------------------------------------------------------------------------------------------------------------
		// pi sent auth_login
		auth_login : function(params) {
			var currentdate = new Date();
			var datetime_stamp = "[" +currentdate.getHours() + ":"
							+ currentdate.getMinutes() + ":"
							+ currentdate.getSeconds()+"]: ";

			console.debug(datetime_stamp +"received auth login & device elems data from pi!")
			
			/* Inicio IRD */
			if (sessionStorage.getItem("element"))
			{
				console.debug("salir")
				return
				
			}
			// clear list
			$('#ind_elem_list li').each( function(i,item) {
				if (i == 0) return
				$(item).remove() // clear list except for header
			})

			sessionStorage.setItem("industria", params.ind_elem_data.device_elements);
			var len_list_elems=params.ind_elem_data.device_elements.length
			var list_of_elems=""
         
			for( var i=0; i<=len_list_elems; i++ ){



				var ul = document.getElementById("ind_elem_list");
				var li = document.createElement("li");
				
				var newAnchor = document.createElement("a");

				newAnchor.textContent = params.ind_elem_data.device_elements[i];
				
				/*IRD*/
				if (params.ind_elem_data.device_elements[i]=="MACARBOX_FFG_ELEMENT")
				{
					newAnchor.setAttribute('onclick',
                                       'sessionStorage.setItem("element","'+params.ind_elem_data.device_elements[i]+'")'
			);	
				newAnchor.setAttribute('href', "/ind_elem/");
				}
			/* Fin IRD */
				
				
				
				li.appendChild(newAnchor);
				li.setAttribute("id","ind_element_"+i);
				ul.appendChild(li);



			}

			// iterating over a dict of resource:presence items
			/*
			for ( i in params.ind_elem_data.device_elements ) {
				remoht.show_ind_elems(i,'available')
			}
			*/

			$('#full_JID').text(params.jid)
//            $('#ind_elements').text(list_of_elems)
		},

        //------------------------------------------------------------------------------------------------------------
		// pi sent twitter feed
		tweet_feed : function(params) {
			console.debug("received tweet feed from pi!")
            $('#twitter_feed').text(params)
		}

	},
	
	/* INICIO IRD 04/09/2015 
       Función que vuelca los datos de la situación actual evitando tener que esperar a que la llegada de los 
	   mensajes realice esta tarea 
	*/
		inicializa_datos : function() {
			
							remoht.mi_grafica()
							
							//remoht.mi_grafica_global2()
							//remoht.recupera_datos2()
							
 
							$('#full_JID').text(sessionStorage.getItem("jid"))
							$('#current_date').text(sessionStorage.getItem("datestamp"))
							$('#temp').text(sessionStorage.getItem("temp"))
							$('#light').text(sessionStorage.getItem("light"))
							
							$('#device_header .device_name').text(sessionStorage.getItem("devicejid") + '/' + sessionStorage.getItem("logged"))
							
							if ((typeof(sessionStorage.getItem("imagen")) == 'string') && (sessionStorage.getItem("imagen") != 'undefined'))
							{	 
						        console.debug("IMAGEN16"); 
								var list_of_image_sesion = $.map(JSON.parse(sessionStorage.getItem("imagen"))[sessionStorage.getItem("element")]["ind_element_subelements_json"], function(v, i){
								return i;
							     });
							console.debug("list of image sesion ", list_of_image_sesion);
							
							/* empieza prueba arbol*/
							var ul = document.getElementById("nivel_1");
						   
							
							if (ul.innerHTML =="") 
							{
								
								$('#nivel_1 li').each( function(i,item) 
								{
									if (i == 0) return
									$(item).remove() // clear list except for header
								})
			
			
								ul.innerHTML = sessionStorage.getItem("element");
								
								
								var ul0= document.createElement("ul");
								
								ul.appendChild(ul0);
								
								
								//alert("entra 44");
								for( MBOX_item in list_of_image_sesion )
								{
									var li = document.createElement("li");
									li.setAttribute("id","nivel_1"+MBOX_item);
									li.setAttribute('onclick','$("#tab-nondiv-container").easytabs("select", "#nondiv-tab'+MBOX_item+'")');
									li.innerHTML= list_of_image_sesion[MBOX_item]
									ul0.appendChild(li);
									var ul2= document.createElement("ul");
									li.appendChild(ul2);
				
									var list_of_image_sesion3 = $.map(JSON.parse(sessionStorage.getItem("imagen"))[sessionStorage.getItem("element")]["ind_element_subelements_json"][list_of_image_sesion[MBOX_item]]["ind_element_subelements_json"], function(v, i){
									return i;
									});
									console.debug("list of image sesion 3 ", list_of_image_sesion3)
									
									for( MBOX_item2 in list_of_image_sesion3 )
									{
										var li = document.createElement("li")
										li.setAttribute("id","nivel_1"+MBOX_item+"_"+MBOX_item2);
										li.setAttribute('data-jstree','{"type":"fichero" }');
										//li.setAttribute("class","jstree-file");
										var valor3 = list_of_image_sesion3[MBOX_item2];
					
										var valor = JSON.parse(sessionStorage.getItem("imagen"))[sessionStorage.getItem("element")]["ind_element_subelements_json"][list_of_image_sesion[MBOX_item]]["ind_element_subelements_json"][valor3];
						                li.setAttribute('title',valor3);
										var inicio = valor3.substring(0,4);
						
										if (inicio =="ind_")
										{		
											li.innerHTML= valor3;
										}
										else
										{
											var ans = ('---------------------------').substring(valor3.length);
											li.innerHTML= valor3 + ans + valor;
										}
										ul2.appendChild(li);
									}
									
									
								}
								
							}
							$('#arbol').jstree({
								"types" : {
											"fichero" : { "icon" : "jstree-file"},
											"default" : {"icon" : "jstree-folder"}
										   },
								"plugins" : [ "types", "contextmenu"],
								"contextmenu": {
												"items": function ($node) {
																			var CurrentNode = $("#arbol").jstree("get_selected");
																			var attr = $('#'+CurrentNode).attr('title');
																			//alert($('#'+CurrentNode).attr('id').length);
																			//if ($('#'+CurrentNode).attr('id').length != 9)	
																			if (!attr)
																			{
																				var tmp =[];
                                                                                return tmp;
																			}
																			else
																			{	
																			return {
																					Visualizar: {
																									label: "Gráfica",
																									action: function (node) 
																											{  
																											 //alert("selec: " + $('#'+CurrentNode).attr('id'));
																											 //elemento= document.getElementById($('#'+CurrentNode).attr('id'));
																											 //alert("select5 "+ elemento.innerHTML.val());
																											 //alert("selec1: " + $('#'+CurrentNode).attr('title'));
																											 //alert("selec2: " + $('#'+CurrentNode).val());
																											 
																											var titulo = $('#'+CurrentNode).attr('title');
																											var valor = $('#'+CurrentNode).val(); 
																											 	$("#chart").find('span').each(function() 
																												{
																												
																												 if ($(this).hasClass('title'))
																												 {	 
																												  //alert('1');	
																												  if ($(this).text() == 'Tercero')
																												  {
																													  $(this).text(titulo);
																													  return false;
																												  }
																												  else if ($(this).text() == 'Cuarto')
																												  {
																													   $(this).text(titulo);
																													   return false;
																												  }
																													  
																											      //alert($(this).html());
																												  //alert('2');
																												  //alert($(this).text());
																												 }
																												})
																											}
																								},
																					Modificar: {
																								label: "Modificar"
																								}
																						};
																			}
																			}
												}
								});
								
								//seccion pestañas
							
							
								
								var contenedor = document.getElementById("containermio");
								
								var formulario = document.createElement("form");
								formulario.setAttribute("id","tab-nondiv-container");
								formulario.setAttribute("class","tab-container");
								
								contenedor.appendChild(formulario);
								
								ul = document.createElement("ul");
								ul.setAttribute("class","etabs");
								
								division = document.createElement("div");
								division.setAttribute("class","field-container");
								division.setAttribute("id","detalle");
								
								
								formulario.appendChild(ul);
								formulario.appendChild(division);
								
								
								for( MBOX_item in list_of_image_sesion )
								{
									li = document.createElement("li");
									if (MBOX_item==0)
									{
										li.setAttribute("id","nondiv-default");
									}
								    li.setAttribute("class","tab");
									
									ancla = document.createElement("a");
									ancla.textContent = list_of_image_sesion[MBOX_item].substring(13);
									ancla.setAttribute("href", "#nondiv-tab"+MBOX_item);
									
									li.appendChild(ancla);
									ul.appendChild(li);
									
									campo = document.createElement("fieldset");
								    campo.setAttribute("id","nondiv-tab"+MBOX_item);
									
									
									var list_of_image_sesion3 = $.map(JSON.parse(sessionStorage.getItem("imagen"))[sessionStorage.getItem("element")]["ind_element_subelements_json"][list_of_image_sesion[MBOX_item]]["ind_element_subelements_json"], function(v, i){
									return i;
									});
									console.debug("list of image sesion 3 ", list_of_image_sesion3)
									
									for( MBOX_item2 in list_of_image_sesion3 )
									{
										
										 var valor3 = list_of_image_sesion3[MBOX_item2];
				                         var valor = JSON.parse(sessionStorage.getItem("imagen"))[sessionStorage.getItem("element")]["ind_element_subelements_json"][list_of_image_sesion[MBOX_item]]["ind_element_subelements_json"][valor3];
										
										grupo = document.createElement("div");
										 grupo.setAttribute("class","form-group");
										 
										 var etiqueta = document.createElement("label");
										 etiqueta.textContent=list_of_image_sesion3[MBOX_item2];
										 etiqueta.setAttribute("for","inp_"+MBOX_item+"_"+MBOX_item2);
										
										 
										var caja= document.createElement("input");
									    caja.setAttribute("type","text");
										caja.setAttribute("id","inp_"+MBOX_item+"_"+MBOX_item2);
										caja.setAttribute("onchange", "$(this).addClass('cambiado')");
										
										var inicio = valor3.substring(0,4);
						
										if (inicio !="ind_")
										{	
											caja.setAttribute("value",valor);
										}
										else
										{
											caja.setAttribute("disabled", true);
										}
									   
										
										grupo.appendChild(etiqueta);
										grupo.appendChild(caja);
										
										campo.appendChild(grupo)
										
								    }
									 division.appendChild(campo);
									
									
								}
								
								$('#tab-nondiv-container').easytabs({tabs: ".etabs li"});
								
								console.debug("antes llamada2");
								
								
								
								
							
								
								
							}  
							
						
						    
							
							
							
		remoht.open_channel()
		    },
			// Función que alimenta los datos del dispositivo seleccionado al volver de la página de detalle 
			inicializa_datos_indice : function() {
                            if (sessionStorage.getItem("logged"))
							{
								remoht.current_device_id = sessionStorage.getItem("device")	
								$('#full_JID').text(sessionStorage.getItem("jid"))
								$('#current_date').text(sessionStorage.getItem("datestamp"))
								$('#temp').text(sessionStorage.getItem("temp"))
								$('#light').text(sessionStorage.getItem("light"))
								$('#device_header .device_name').text(sessionStorage.getItem("devicejid") + 
							                                      '/' + sessionStorage.getItem("logged"))
								
								
								// clear list
								$('#ind_elem_list li').each( function(i,item) {
								if (i == 0) return
								$(item).remove() // clear list except for header
								})

								// Aqui recuperamos los datos de los elementos almacenados en la variable de sesión
								// Puesto que todas las variables de sesión se almacenan como cadenas de caracteres
								// (string) y nosotros necesitamos un array de elementos, convertiremos la lista de 
								// elementos separados por comas en un array gracias a la función split
								
								var elementos_indus = sessionStorage.getItem("industria").split(",");
								var len_list_elems=elementos_indus.length;
			
			
								var list_of_elems="";
			
								for( var i=0; i<=len_list_elems; i++ )
								{
									var ul = document.getElementById("ind_elem_list");
									var li = document.createElement("li");
									var newAnchor = document.createElement("a");

									newAnchor.textContent = elementos_indus[i];
									// hacemos que se almacene el elemento pinchado en una variable de sesión 
									if ( elementos_indus[i]=="MACARBOX_FFG_ELEMENT")
									{
									newAnchor.setAttribute('onclick',
														   'sessionStorage.setItem("element","'+
														   elementos_indus[i]+'")'
															);	
						
									// Le indicamos a que página debe dirigirse
									newAnchor.setAttribute('href', "/ind_elem/");
									}
									li.appendChild(newAnchor);
									li.setAttribute("id","ind_element_"+i);
									ul.appendChild(li);



								}

			
								
							}
							
		
		    },
			cambios : function() {
				//alert("datos iniciales42");
				 					var lista_cambios= new Array();
									
									 
									 
									$("#tab-nondiv-container").find(':input').each(function() {
										var elemento= this;
										if ($(elemento).hasClass('cambiado')){
										var pos =(elemento.id).indexOf('_',4);
				    					var i1= parseInt((elemento.id).substring(4,pos));
										var i2= parseInt((elemento.id).substring(pos+1));
					
										var list_of_image_sesion = $.map(JSON.parse(sessionStorage.getItem("imagen"))[sessionStorage.getItem("element")]["ind_element_subelements_json"], function(v, i){
								return i;
							     		});
								 
					 					var list_of_image_sesion31 = $.map(JSON.parse(sessionStorage.getItem("imagen"))[sessionStorage.getItem("element")]["ind_element_subelements_json"][list_of_image_sesion[i1]]["ind_element_subelements_json"], function(v, i){
									return i;
										});
										
										var nivel1 =  list_of_image_sesion[i1];				
										var nivel2 = list_of_image_sesion31[i2];
										
										//alert("nivel1="+ nivel1 + ", nivel2=" + nivel2 + ", valor=" + elemento.value); 
										
										var cambio = new Object();
										cambio.nivel1 = nivel1;
										cambio.nivel2 = nivel2;
										cambio.valor = elemento.value;
										
										lista_cambios.push(cambio);
										
										console.debug('Modificación: ',lista_cambios[0].nivel1+'-'+lista_cambios[0].nivel2+'-'+lista_cambios[0].valor);
				
			
										}
					 			});
					
        
					
				
								},
    mi_grafica: function() {
		//alert("empieza_grafica23");
		var context = cubism.context()
			.serverDelay(0) 
			.clientDelay(0)
			.step(1e4)							//resolution: 10 sec steps
			.size($('#chart').width()) // //number of pixels/points of charts TODO dynamically resize
//			.size(1920)

//		var graphite = context					//context.graphite: define a datasource for Graphite metrics
//			.graphite("http://example.com");

// 		CONTEXT is the big chart panel
//		HORIZON is each of the subcharts

						




		var chartHeight= 30
		var source = remoht.cubism_source(context)
		var temp = source.metric('temp_c', 'Temp °C')
		var light = source.metric('light_pct', 'Light')

		var otro1 = source.metric('nuevo', 'Tercero');
		var otro2 = source.metric('nuevo2', 'Cuarto');
		
		var horizonTemp = context.horizon()
			.height(chartHeight).mode("offset")
			.extent([5.0, 100.0])
			.colors(["#08519c","#3182bd","#bdd7e7","#6baed6"])

		var horizonLight = context.horizon()
			.height(chartHeight).mode("offset")
			.extent([5.0, 100.0])
			.colors(["#ea9611","#f3ba5f","#f3ba5f","#ea9611"])
			
		var horizonOtro1 = context.horizon()
			.height(chartHeight).mode("offset")
			.extent([5.0, 100.0])
			.colors(["#ea96ff","#f3baff","#f3baff","#ea96ff"])
		
		var horizonOtro2 = context.horizon()
			.height(chartHeight).mode("offset")
			.extent([5.0, 100.0])
			.colors(["#ea9600","#f3ba00","#f3ba00","#ea9600"])

		d3.select('#chart').call(function(div) {
			div.append("div").attr("class", "axis")
				.call( context.axis()
					.orient("top")
					.ticks(d3.time.minutes, 30)
					.tickSubdivide(5) )
					
			div.append("div").datum(temp)
				.attr("class", "horizon")
				.call(horizonTemp)

			div.append("div").datum(light)
				.attr("class", "horizon")
				.call(horizonLight)
				
			div.append("div").datum(otro1)
				.attr("class", "horizon")
				.call(horizonOtro1)
				
			div.append("div").datum(otro2)
				.attr("class", "horizon")
				.call(horizonOtro2)
				
			div.append("div")
				.attr("class", "rule")
				.call(context.rule()); 
		})
		
		context.on("focus", function(i) {
			d3.selectAll(".value").style(
				"right", i == null ? null : context.size() - i + "px");
		})
	},
	 mi_grafica_global: function() {
		 //alert("global7");
	
	
		var context = cubism.context()
			.serverDelay(0) 
			.clientDelay(0)
			.step(2e4)					//resolution: 10 sec steps
			//.step(3e5)                      // Cada 5 minutos
			//.step(6e4)                      //cada minuto
			.size($('#chart2').width()) // //number of pixels/points of charts TODO dynamically resize
										//			En nuestro caso el ancho en pixeles sera 770


			// 		CONTEXT is the big chart panel
			//		HORIZON is each of the subcharts
		
		
		var chartHeight= 60
		//var source = remoht.cubism_source(context)
		
		var horizon = context.horizon().extent([0.0,50.0]).height(chartHeight).mode("offset")

		// define metric accessor
		function random_ma(name) 
		{
				return context.metric(function(start,stop,step,callback){
				var values = [];
				while (+start < +stop)
				{ 
					start = +start +step; 
					values.push(Math.random()*50);
				}
				//alert(values.length);
				callback(null, values);
				}, name);
		}

		// draw graph
		var metrics = ["global"];
		horizon.metric(random_ma);
		
		d3.select("#chart2").selectAll(".horizon")
							.data(metrics)
							.enter()
							.append("div")
							.attr("class", "horizon")
							.call(horizon);
	  
		d3.select("#cuerpo").append("div")
							.attr("class", "rule")
							.call(context.rule()); 
		
		
		context.on("focus", function(i) {
			d3.selectAll(".value").style(
				"right", i == null ? null : context.size() - i + "px");
		})
		
		// set axis 
		var axis = context.axis()
		d3.select("#cuerpo").append("div").attr("class", "axis").append("g").call(axis);

	},
	
	mi_grafica_global2: function() {
		 //alert("global12");
	
	
		var context = cubism.context()
			.serverDelay(0) 
			.clientDelay(0)
			.step(1e4)					//resolution: 10 sec steps
			//.step(3e5)                      // Cada 5 minutos
			//.step(6e4)                      //cada minuto
			.size($('#chart2').width()) // //number of pixels/points of charts TODO dynamically resize
			.stop();
					


			// 		CONTEXT is the big chart panel
			//		HORIZON is each of the subcharts
		
		
		var chartHeight= 65
		
		
		var horizon = context.horizon().extent([0.00,65.00]).height(chartHeight).mode("offset")

		var mijson = [[2, 64.64], [3, 64.66], [4, 64.52], [5, 64.39], [6, 64.23], [7, 64.2], [8, 64.28], [9, 64.27], [10, 64.3], [11, 64.235], [12, 64.34], [13, 64.5], [14, 64.5499], [15, 64.67], [16, 64.7], [17, 64.78], [18, 64.81], [19, 64.68], [21, 64.72], [22, 64.8], [23, 64.87], [24, 64.77], [25, 64.715], [26, 64.57], [27, 64.77], [28, 64.65], [29, 64.78], [30, 64.81], [31, 64.76], [32, 64.78], [33, 64.77], [34, 64.69], [35, 64.69], [36, 64.62], [37, 64.57], [38, 64.57], [39, 64.59], [40, 64.56], [41, 64.62], [42, 64.67], [43, 64.62], [44, 64.67], [45, 64.54], [46, 64.52], [47, 64.5], [49, 64.5], [50, 64.52], [51, 64.52], [52, 64.52], [53, 64.41], [54, 64.36], [55, 64.305], [57, 64.34], [58, 64.34], [59, 64.38], [61, 64.35], [62, 64.35], [64, 64.35], [65, 64.35], [66, 64.32], [69, 64.3196], [70, 64.38], [71, 64.38], [72, 64.26], [73, 64.21], [74, 64.15], [75, 64.15], [76, 64.04], [77, 63.96], [78, 63.97], [79, 63.89], [80, 63.934], [81, 63.99], [82, 64.0], [83, 63.91], [84, 64.01], [86, 64.0], [87, 64.03], [88, 64.03], [89, 64.01], [91, 64.03], [92, 64.03], [93, 64.1], [94, 64.11], [95, 64.13], [96, 64.1], [97, 64.075], [98, 64.09], [99, 64.07], [100, 64.03], [101, 64.03], [102, 64.025], [104, 64.03], [105, 64.01], [106, 64.08], [108, 64.085], [109, 64.08], [110, 64.065], [111, 64.07], [112, 64.03], [113, 64.03], [114, 64.06], [115, 64.1], [116, 64.085], [117, 64.09], [118, 64.14], [120, 64.1], [121, 64.055], [122, 64.085], [123, 64.08], [124, 64.05], [125, 64.07], [126, 64.09], [127, 64.06], [128, 64.08], [129, 64.09], [130, 64.12], [131, 64.12], [132, 64.1], [133, 64.12], [134, 64.13], [135, 64.19], [136, 64.2], [137, 64.21], [138, 64.19], [139, 64.205], [140, 64.2], [141, 64.24], [142, 64.22], [143, 64.2], [144, 64.2], [145, 64.2], [146, 64.185], [147, 64.18], [148, 64.2], [149, 64.2], [150, 64.205], [151, 64.24], [152, 64.225], [153, 64.19], [154, 64.255], [155, 64.29], [156, 64.26], [157, 64.245], [158, 64.25], [159, 64.27], [160, 64.29], [161, 64.3], [162, 64.31], [164, 64.248], [165, 64.23], [166, 64.21], [167, 64.2], [168, 64.23], [169, 64.23], [170, 64.24], [173, 64.22], [174, 64.23], [176, 64.249], [177, 64.27], [178, 64.28], [180, 64.28], [181, 64.26], [182, 64.27], [185, 64.31], [186, 64.3], [187, 64.3], [188, 64.28], [191, 64.295], [192, 64.295], [194, 64.32], [195, 64.34], [196, 64.36], [197, 64.37], [198, 64.41], [199, 64.43], [200, 64.44], [201, 64.46], [202, 64.45], [203, 64.4], [204, 64.43], [205, 64.44], [206, 64.43], [207, 64.43], [208, 64.435], [209, 64.47], [212, 64.46], [213, 64.46], [214, 64.45], [215, 64.45], [216, 64.46], [217, 64.5], [218, 64.5], [219, 64.52], [220, 64.52], [221, 64.5011], [222, 64.52], [224, 64.52], [225, 64.4925], [226, 64.5], [227, 64.54], [228, 64.61], [229, 64.63], [230, 64.63], [231, 64.63], [232, 64.73], [235, 64.71], [236, 64.76], [237, 64.79], [238, 64.8], [239, 64.7675], [240, 64.71], [241, 64.67], [242, 64.69], [243, 64.66], [244, 64.66], [245, 64.62], [246, 64.645], [247, 64.62], [248, 64.61], [249, 64.59], [250, 64.59], [251, 64.59], [252, 64.59], [253, 64.59], [254, 64.59], [255, 64.58], [256, 64.62], [261, 64.655], [262, 64.65], [264, 64.64], [265, 64.65], [266, 64.59], [267, 64.56], [268, 64.57], [269, 64.59], [270, 64.585], [271, 64.56], [272, 64.54], [273, 64.56], [274, 64.57], [275, 64.59], [277, 64.59], [278, 64.61], [279, 64.64], [280, 64.65], [282, 64.69], [283, 64.67], [284, 64.68], [285, 64.66], [286, 64.64], [287, 64.58], [288, 64.55], [289, 64.55], [290, 64.55], [292, 64.5525], [293, 64.57], [294, 64.58], [295, 64.58], [296, 64.5905], [297, 64.57], [298, 64.55], [300, 64.56], [301, 64.59], [302, 64.61], [304, 64.62], [305, 64.62], [306, 64.635], [307, 64.64], [308, 64.639], [309, 64.639], [310, 64.65], [311, 64.67], [312, 64.7], [313, 64.69], [314, 64.71], [315, 64.7], [316, 64.72], [317, 64.73], [318, 64.69], [320, 64.72], [321, 64.74], [322, 64.81], [323, 64.78], [324, 64.78], [325, 64.77], [326, 64.77], [327, 64.8], [328, 64.8], [329, 64.775], [330, 64.73], [331, 64.75], [333, 64.72], [334, 64.71], [335, 64.7175], [336, 64.73], [337, 64.74], [338, 64.8], [339, 64.84], [340, 64.8], [341, 64.78], [342, 64.8], [344, 64.81], [345, 64.83], [346, 64.83], [347, 64.87], [349, 64.87], [351, 64.92], [352, 64.88], [353, 64.88], [354, 64.88], [355, 64.86], [356, 64.8699], [357, 64.805], [358, 64.81], [359, 64.8], [360, 64.74], [361, 64.75], [364, 64.8], [365, 64.78], [366, 64.79], [368, 64.805], [369, 64.78], [371, 64.795], [372, 64.78], [373, 64.76], [374, 64.77], [376, 64.78], [377, 64.78], [378, 64.7798], [379, 64.77], [380, 64.74], [381, 64.75], [382, 64.75], [383, 64.75], [384, 64.73], [385, 64.75], [386, 64.78], [387, 64.755], [388, 64.76], [393, 64.77],[2, 64.64], [3, 64.66], [4, 64.52], [5, 64.39], [6, 64.23], [7, 64.2], [8, 64.28], [9, 64.27], [10, 64.3], [11, 64.235], [12, 64.34], [13, 64.5], [14, 64.5499], [15, 64.67], [16, 64.7], [17, 64.78], [18, 64.81], [19, 64.68], [21, 64.72], [22, 64.8], [23, 64.87], [24, 64.77], [25, 64.715], [26, 64.57], [27, 64.77], [28, 64.65], [29, 64.78], [30, 64.81], [31, 64.76], [32, 64.78], [33, 64.77], [34, 64.69], [35, 64.69], [36, 64.62], [37, 64.57], [38, 64.57], [39, 64.59], [40, 64.56], [41, 64.62], [42, 64.67], [43, 64.62], [44, 64.67], [45, 64.54], [46, 64.52], [47, 64.5], [49, 64.5], [50, 64.52], [51, 64.52], [52, 64.52], [53, 64.41], [54, 64.36], [55, 64.305], [57, 64.34], [58, 64.34], [59, 64.38], [61, 64.35], [62, 64.35], [64, 64.35], [65, 64.35], [66, 64.32], [69, 64.3196], [70, 64.38], [71, 64.38], [72, 64.26], [73, 64.21], [74, 64.15], [75, 64.15], [76, 64.04], [77, 63.96], [78, 63.97], [79, 63.89], [80, 63.934], [81, 63.99], [82, 64.0], [83, 63.91], [84, 64.01], [86, 64.0], [87, 64.03], [88, 64.03], [89, 64.01], [91, 64.03], [92, 64.03], [93, 64.1], [94, 64.11], [95, 64.13], [96, 64.1], [97, 64.075], [98, 64.09], [99, 64.07], [100, 64.03], [101, 64.03], [102, 64.025], [104, 64.03], [105, 64.01], [106, 64.08], [108, 64.085], [109, 64.08], [110, 64.065], [111, 64.07], [112, 64.03], [113, 64.03], [114, 64.06], [115, 64.1], [116, 64.085], [117, 64.09], [118, 64.14], [120, 64.1], [121, 64.055], [122, 64.085], [123, 64.08], [124, 64.05], [125, 64.07], [126, 64.09], [127, 64.06], [128, 64.08], [129, 64.09], [130, 64.12], [131, 64.12], [132, 64.1], [133, 64.12], [134, 64.13], [135, 64.19], [136, 64.2], [137, 64.21], [138, 64.19], [139, 64.205], [140, 64.2], [141, 64.24], [142, 64.22], [143, 64.2], [144, 64.2], [145, 64.2], [146, 64.185], [147, 64.18], [148, 64.2], [149, 64.2], [150, 64.205], [151, 64.24], [152, 64.225], [153, 64.19], [154, 64.255], [155, 64.29], [156, 64.26], [157, 64.245], [158, 64.25], [159, 64.27], [160, 64.29], [161, 64.3], [162, 64.31], [164, 64.248], [165, 64.23], [166, 64.21], [167, 64.2], [168, 64.23], [169, 64.23], [170, 64.24], [173, 64.22], [174, 64.23], [176, 64.249], [177, 64.27], [178, 64.28], [180, 64.28], [181, 64.26], [182, 64.27], [185, 64.31], [186, 64.3], [187, 64.3], [188, 64.28], [191, 64.295], [192, 64.295], [194, 64.32], [195, 64.34], [196, 64.36], [197, 64.37], [198, 64.41], [199, 64.43], [200, 64.44], [201, 64.46], [202, 64.45], [203, 64.4], [204, 64.43], [205, 64.44], [206, 64.43], [207, 64.43], [208, 64.435], [209, 64.47], [212, 64.46], [213, 64.46], [214, 64.45], [215, 64.45], [216, 64.46], [217, 64.5], [218, 64.5], [219, 64.52], [220, 64.52], [221, 64.5011], [222, 64.52], [224, 64.52], [225, 64.4925], [226, 64.5], [227, 64.54], [228, 64.61], [229, 64.63], [230, 64.63], [231, 64.63], [232, 64.73], [235, 64.71], [236, 64.76], [237, 64.79], [238, 64.8], [239, 64.7675], [240, 64.71], [241, 64.67], [242, 64.69], [243, 64.66], [244, 64.66], [245, 64.62], [246, 64.645], [247, 64.62], [248, 64.61], [249, 64.59], [250, 64.59], [251, 64.59], [252, 64.59], [253, 64.59], [254, 64.59], [255, 64.58], [256, 64.62], [261, 64.655], [262, 64.65], [264, 64.64], [265, 64.65], [266, 64.59], [267, 64.56], [268, 64.57], [269, 64.59], [270, 64.585], [271, 64.56], [272, 64.54], [273, 64.56], [274, 64.57], [275, 64.59], [277, 64.59], [278, 64.61], [279, 64.64], [280, 64.65], [282, 64.69], [283, 64.67], [284, 64.68], [285, 64.66], [286, 64.64], [287, 64.58], [288, 64.55], [289, 64.55], [290, 64.55], [292, 64.5525], [293, 64.57], [294, 64.58], [295, 64.58], [296, 64.5905], [297, 64.57], [298, 64.55], [300, 64.56], [301, 64.59], [302, 64.61], [304, 64.62], [305, 64.62], [306, 64.635], [307, 64.64], [308, 64.639], [309, 64.639], [310, 64.65], [311, 64.67], [312, 64.7], [313, 64.69], [314, 64.71], [315, 64.7], [316, 64.72], [317, 64.73], [318, 64.69], [320, 64.72], [321, 64.74], [322, 64.81], [323, 64.78], [324, 64.78], [325, 64.77], [326, 64.77], [327, 64.8], [328, 64.8], [329, 64.775], [330, 64.73], [331, 64.75], [333, 64.72], [334, 64.71], [335, 64.7175], [336, 64.73], [337, 64.74], [338, 64.8], [339, 64.84], [340, 64.8], [341, 64.78], [342, 64.8], [344, 64.81], [345, 64.83], [346, 64.83], [347, 64.87], [349, 64.87], [351, 64.92], [352, 64.88], [353, 64.88], [354, 64.88], [355, 64.86], [356, 64.8699], [357, 64.805], [358, 64.81], [359, 64.8], [360, 64.74], [361, 64.75], [364, 64.8], [365, 64.78], [366, 64.79], [368, 64.805], [369, 64.78], [371, 64.795], [372, 64.78], [373, 64.76], [374, 64.77], [376, 64.78], [377, 64.78], [378, 64.7798], [379, 64.77], [380, 64.74], [381, 64.75], [382, 64.75], [383, 64.75], [384, 64.73], [385, 64.75], [386, 64.78], [387, 64.755], [388, 64.76], [393, 64.77],[2, 64.64], [3, 64.66], [4, 64.52], [5, 64.39], [6, 64.23], [7, 64.2], [8, 64.28], [9, 64.27], [10, 64.3], [11, 64.235], [12, 64.34], [13, 64.5], [14, 64.5499], [15, 64.67], [16, 64.7], [17, 64.78], [18, 64.81], [19, 64.68], [21, 64.72], [22, 64.8], [23, 64.87], [24, 64.77], [25, 64.715], [26, 64.57], [27, 64.77], [28, 64.65], [29, 64.78], [30, 64.81], [31, 64.76], [32, 64.78], [33, 64.77], [34, 64.69], [35, 64.69], [36, 64.62], [37, 64.57], [38, 64.57], [39, 64.59], [40, 64.56], [41, 64.62], [42, 64.67], [43, 64.62], [44, 64.67], [45, 64.54], [46, 64.52], [47, 64.5], [49, 64.5], [50, 64.52], [51, 64.52], [52, 64.52], [53, 64.41], [54, 64.36], [55, 64.305], [57, 64.34], [58, 64.34], [59, 64.38], [61, 64.35], [62, 64.35], [64, 64.35], [65, 64.35], [66, 64.32], [69, 64.3196], [70, 64.38], [71, 64.38], [72, 64.26], [73, 64.21], [74, 64.15], [75, 64.15], [76, 64.04], [77, 63.96], [78, 63.97], [79, 63.89], [80, 63.934], [81, 63.99], [82, 64.0], [83, 63.91], [84, 64.01],[2, 64.64], [3, 64.66], [4, 64.52], [5, 64.39], [6, 64.23], [7, 64.2], [8, 64.28], [9, 64.27], [10, 64.3], [11, 64.235], [12, 64.34], [13, 64.5]];
		
		// define metric accessor
		function random_ma(name) 
		{
				return context.metric(function(start,stop,step,callback){
				var values = [];
				
				for (var d=0; d < mijson.length;d++)
				{
						  values.push(mijson[d][1]);
                }
				
				callback(null, values);
				}, name);
		}

		// draw graph
		var metrics = ["global"];
		horizon.metric(random_ma);
		
		d3.select("#chart2").selectAll(".horizon")
							.data(metrics)
							.enter()
							.append("div")
							.attr("class", "horizon")
							.call(horizon);
	  
		d3.select("#cuerpo").append("div")
							.attr("class", "rule")
							.call(context.rule()); 
		
		
		context.on("focus", function(i) {
										d3.selectAll(".value").style(
										"right", i == null ? null : context.size() - i + "px");
										})
		
		// set axis 
		var axis = context.axis()
		d3.select("#cuerpo").append("div").attr("class", "axis").append("g").call(axis);

	},
	recupera_datos: function() {
		
	var clientId = '351031765602-p92d119k9mhn04b9i9v908gjav59blrn.apps.googleusercontent.com';
	var datasetId = 'groovy-legacy-814';
	//var scopes = 'https://www.googleapis.com/auth/datastore';
	var scopes = 'https://www.googleapis.com/auth/datastore \ https://www.googleapis.com/auth/userinfo.email';
    
	gapi.auth.authorize(
    {client_id: clientId, scope: scopes, immediate: false},
    function(authResult) {
      if (authResult && !authResult.error) {
		  //alert("pasa511");	  
		  gapi.client.load('datastore', 'v1beta2').then(function() { 
                console.log('loaded.'); 
                /*gapi.client.datastore.datasets.runQuery({'datasetId': datasetId ,'gqlQuery': {'queryString': 'select * from Ind_Datapoint'}}).then(function(resp) {
                        console.log(resp.result);
                    }, function(reason) {
                        console.log('Error: ' + reason.result.error.message);}
                    );*/
				gapi.client.datastore.datasets.runQuery({'datasetId': datasetId , 'resource': 
				{'query': {'kinds': [{'name': 'Ind_Datapoint'}],
				           'filter':{
									  'propertyFilter': {
														  'property': {
																		'name': 'Ind_Datapoint_owner'
																	   },
														   'operator': 'equal',
														   'value':    {
																		'stringValue': 'macarbox003@gmail.com/pi_black:'
																		}
														}
						   },
						   'limit':770
						   }}
    }).then(function(resp) {
                       
					   sessionStorage.setItem("datos_almacen", JSON.stringify(resp.result));
					  
						var lista_elementos=resp.result["batch"]["entityResults"];
						console.debug(lista_elementos);
						var longi=lista_elementos.length;
						console.debug(longi);
						for( var i=0; i<longi; i++ )
						{

						var list_data_datastamp = resp.result["batch"]["entityResults"][i]["entity"]["properties"]["Ind_Datapoint_data_timestamp"]["dateTimeValue"];

						var list_data_owner = resp.result["batch"]["entityResults"][i]["entity"]["properties"]["Ind_Datapoint_owner"]["stringValue"];

						var list_data = resp.result["batch"]["entityResults"][i]["entity"]["properties"]["Ind_Datapoint_data_value"]["blobValue"];
						  var decodedData = window.atob(list_data);
						  var tempera = JSON.parse(decodedData)["Core_Temp"];
						console.debug('Temperatura: ',list_data_datastamp,list_data_owner,tempera);
						}
                    }, function(reason) {
                        console.log('Error: ' + reason.result.error.message);
						}
                    );		
				
            });
       
      }
    });

		
	},
	recupera_datos2: function() {
	var mijson=new Array();
	var clientId = '351031765602-p92d119k9mhn04b9i9v908gjav59blrn.apps.googleusercontent.com';
	var datasetId = 'groovy-legacy-814';

	var scopes = 'https://www.googleapis.com/auth/datastore \ https://www.googleapis.com/auth/userinfo.email';
    

	gapi.auth.authorize(
    {client_id: clientId, scope: scopes, immediate: false},
    function(authResult) {
      if (authResult && !authResult.error) {
		  alert("pasa511");	  
		  gapi.client.load('datastore', 'v1beta2').then(function() { 
                console.log('loaded.'); 
              
				gapi.client.datastore.datasets.runQuery({'datasetId': datasetId , 'resource': 
				{'query': {'kinds': [{'name': 'Ind_Datapoint'}],
				           'filter':{
									  'propertyFilter': {
														  'property': {
																		'name': 'Ind_Datapoint_owner'
																	   },
														   'operator': 'equal',
														   'value':    {
																		'stringValue': 'macarbox003@gmail.com/pi_black:'
																		}
														}
						   },
						   'limit':770
						   }}
    }).then(function(resp) {
                       
					  
					  
						var lista_elementos=resp.result["batch"]["entityResults"];
						
						var longi=lista_elementos.length;
						
						for( var i=0; i<longi; i++ )
						{

						var tiempo = resp.result["batch"]["entityResults"][i]["entity"]["properties"]["Ind_Datapoint_data_timestamp"]["dateTimeValue"];

                        var list_data = resp.result["batch"]["entityResults"][i]["entity"]["properties"]["Ind_Datapoint_data_value"]["blobValue"];
						  var decodedData = window.atob(list_data);
						  var tempera = JSON.parse(decodedData)["Core_Temp"];
						  
						  var objeto = new Object();
						  objeto.fecha = tiempo;	
						  objeto.temperatura = tempera;

						  mijson.push(objeto);
						  
						
						}
						
						var context = cubism.context()
						.serverDelay(0) 
						.clientDelay(0)
						.step(1e4)					//resolution: 10 sec steps
						.size($('#chart2').width()) // //number of pixels/points of charts TODO dynamically resize
						.stop();
					    
						var chartHeight= 50
		
		                var horizon = context.horizon().extent([0.00,50.00]).height(chartHeight).mode("offset")
						
						function random_ma(name) 
						{
				           		
							return context.metric(function(start,stop,step,callback){
							var values = [];
				
							for (var d=0; d < mijson.length;d++)
							{
								values.push(mijson[d]['temperatura']);
							}
							console.log('cargados:', values.length); 
							callback(null, values);
						}, name);
						}

						// draw graph
						var metrics = ["global"];
						horizon.metric(random_ma);
		
						d3.select("#chart2").selectAll(".horizon")
							.data(metrics)
							.enter()
							.append("div")
							.attr("class", "horizon")
							.call(horizon);
	  
						d3.select("#cuerpo").append("div")
							.attr("class", "rule")
							.call(context.rule()); 
		
		
						context.on("focus", function(i) {
										d3.selectAll(".value").style(
										"right", i == null ? null : context.size() - i + "px");
										})
		
						// set axis 
						var axis = context.axis()
						d3.select("#cuerpo").append("div").attr("class", "axis").append("g").call(axis);

						

						
                    }, function(reason) {
                        console.log('Error: ' + reason.result.error.message);
						}
                    );		
				
            });
       
      }
    });

		
	}
	
/* FIN IRD 04/09/2015 */
	,
	open_channel : function() {
		var mensajes = [];
		$.ajax('/token/', {
			success: function(data,stat,xhr) {
				remoht.token = data.token
				remoht.channel = new goog.appengine.Channel(remoht.token)
				remoht.mensajes=[]
				
				remoht.channel.open({
					onopen : function() {
						console.debug("Channel opened", arguments)
						
					},

					onmessage : function(msg) {
						console.debug("Channel message", msg)
						try {
							var elemento = new Array(); /* IRD 27/07/2015 array que contendrá la info de cada mensaje*/
							data = JSON.parse(msg.data)
						    console.debug("received xmpp on..:", data.datestamp_msg)
						    console.debug("received cmd is ......:", data.cmd)
							
							
							/* Inicio IRD 28/07/2015 Rellenamos el array */
							elemento[0]= data.datestamp_msg;
							elemento[1]= data.from_msg;
							elemento[2]= data.cmd;
							elemento[3]= data.data;
							elemento[4]= "Twitter Feed";
							
								
							
						    remoht.mensajes.push(elemento);
							
							if (remoht.mensajes.length > 5) //Si supera el máximo de elementos, expulsamos el primero de la cola
							{
		 						remoht.mensajes.shift(); //eliminamos el primeeo que ha entrado en la tabla
							}
							
							$('#debug_msg4').text(remoht.mensajes[0][0]);
							$('#debug_msg_from4').text(remoht.mensajes[0][1]);
							$('#xmpp_msg_type4').text(remoht.mensajes[0][2]);
							$('#xmpp_msg_data4').text(remoht.mensajes[0][3]);

						    if (remoht.mensajes.length > 1)
							{
							$('#debug_msg3').text(remoht.mensajes[1][0]);
							$('#debug_msg_from3').text(remoht.mensajes[1][1]);
							$('#xmpp_msg_type3').text(remoht.mensajes[1][2]);
							$('#xmpp_msg_data3').text(remoht.mensajes[1][3]);
							}

							if (remoht.mensajes.length > 2)
							{
							$('#debug_msg2').text(remoht.mensajes[2][0]);
							$('#debug_msg_from2').text(remoht.mensajes[2][1]);
							$('#xmpp_msg_type2').text(remoht.mensajes[2][2]);
							$('#xmpp_msg_data2').text(remoht.mensajes[2][3]);
							}
						
							if (remoht.mensajes.length > 3)
							{
							$('#debug_msg1').text(remoht.mensajes[3][0]);
							$('#debug_msg_from1').text(remoht.mensajes[3][1]);
							$('#xmpp_msg_type1').text(remoht.mensajes[3][2]);
							$('#xmpp_msg_data1').text(remoht.mensajes[3][3]);
							}
							
							if (remoht.mensajes.length > 4)
							{
							$('#debug_msg').text(remoht.mensajes[4][0]);
							$('#debug_msg_from').text(remoht.mensajes[4][1]);
							$('#xmpp_msg_type').text(remoht.mensajes[4][2]);
							$('#xmpp_msg_data').text(remoht.mensajes[4][3]);
							}
							
							/* Fin IRD 28/07/2015 
							
                            $('#debug_msg').text("received xmpp on......:"+data.datestamp_msg)
                            $('#debug_msg_from').text("received from...........:"+data.from_msg)
                            $('#xmpp_msg_type').text("cmd ................:"+data.cmd)
                            $('#xmpp_msg_data').text("data................:"+data.data)*/
							
							remoht.channel_commands[data.cmd](data.data)
						}
						catch(e) {console.warn("Channel onmessage error", e)}

					},

					onerror : function(err) {
						console.warn(err)
						remoht.open_channel() // re-open channel
					},

					onclose : function() {
						console.debug("Channel closed")
					}
				})	
			}
		})
	},

	start_demo : function() {
		remoht.current_device_id = "DUMMY"
		$('#device_header .device_name').text("(this is demo mode!)")

		remoht.add_device_to_list({
			id : "DUMMY",
			resource : "dummy_device",
			presence : "availablie"
		})

		remoht.show_relays( "DUMMY", {
			relay_1 : 0,
			relay_2 : 1
		})

		var last_vals = {
			device_id : "DUMMY",
			light_pct : 80.0,
			temp_c : 23.4
		}

		rand = function(min, max) {
			return Math.random() * (max - min) + min;
		}

		window.setInterval( function() {
			last_vals.light_pct = Math.max( 0, Math.min( 
					1, last_vals.light_pct/ 100.0 + rand( -.03, .03 ) ) )
			last_vals.temp_c = Math.round(Math.max( 5, Math.min( 
					40, last_vals.temp_c + rand( -2, 2 ) ) ) * 100 ) / 100
			remoht.channel_commands.readings( last_vals )
		}, 2000 )
	},
	
	start_demo_d : function() {
		remoht.current_device_id = "DUMMY"
		$('#device_header .device_name').text("(this is demo mode!)")

		remoht.add_device_to_list({
			id : "DUMMY",
			resource : "dummy_device",
			presence : "availablie"
		})

		remoht.show_relays( "DUMMY", {
			relay_1 : 0,
			relay_2 : 1
		})

		var last_vals = {
			device_id : "DUMMY",
			light_pct : 80.0,
			temp_c : 23.4,
			otro_1: 40.0,
			otro_2:0.0
		}

		rand = function(min, max) {
			return Math.random() * (max - min) + min;
		}

		window.setInterval( function() {
			last_vals.light_pct = Math.max( 0, Math.min( 
					1, last_vals.light_pct/ 100.0 + rand( -.03, .03 ) ) )
			last_vals.temp_c = Math.round(Math.max( 5, Math.min( 
					40, last_vals.temp_c + rand( -2, 2 ) ) ) * 100 ) / 100
			last_vals.otro_1 = Math.max( 0, Math.min( 
					1, last_vals.light_pct/ 100.0 + rand( -.05, .05 ) ) )
			remoht.channel_commands.readings( last_vals )
		}, 2000 )
	}
}
