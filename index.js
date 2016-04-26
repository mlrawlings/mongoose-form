var Form
  , fs = require('fs')
  , dust = require('dustjs-linkedin')
  , template

require('dustjs-helpers')
dust.loadSource(dust.compile(fs.readFileSync(__dirname+'/form.dust', 'utf8'), 'form'))

Form = module.exports = function(schema, definition) {
	var ObjectId = schema.tree._id.type
	schema.add(Form.definitionToSchema(definition, ObjectId))
	schema.set('form', Form.definitionToForm(definition, ObjectId))
	schema.set('definition', Form.flatten(definition))
	schema.static('renderForm', Form.render)
	schema.static('populateFromRequest', Form.populate)
	schema.static('handleSubmission', Form.handleSubmission)
}

Form.definitionToSchema = function(definition, ObjectId) {
	var mongoose_fields = [ 'type', 'default', 'get', 'index', 'ref', 'required', 'select', 'set', 'sparse', 'unique', 'validate' ]
	  , string_types = ['text', 'email', 'phone', 'tel', 'password', 'color', 'url', 'image', 'file', 'html', 'textarea' ]
	  , date_types = [ 'date', 'datetime', 'time', 'month', 'week']
	  , boolean_types = [ 'boolean' ]
	  , number_types = [ 'number' ]
	  , object_types = [ 'ref' ]

	if(!definition || typeof definition != 'object') 
		throw new Error('a valid definition must be passed')

	function recursive(schema, definition) {
		Object.keys(definition).forEach(function(key) {
			var sub_definition = definition[key]
			if(typeof sub_definition == 'object') {
				if(sub_definition.type || (sub_definition.length == 1 && sub_definition[0].type)) {
					var schema_part = {}
					if(sub_definition.type) schema[key] = schema_part
					else {
						schema[key] = [schema_part]
						sub_definition = sub_definition[0]
					}
					Object.keys(sub_definition).forEach(function(field) {
						if(mongoose_fields.indexOf(field) != -1) schema_part[field] = sub_definition[field]
					})
					if(string_types.indexOf(sub_definition.type) != -1) schema_part.type = String
					else if(date_types.indexOf(sub_definition.type) != -1) schema_part.type = Date
					else if(boolean_types.indexOf(sub_definition.type) != -1) schema_part.type = Boolean
					else if(number_types.indexOf(sub_definition.type) != -1) schema_part.type = Number
					else if(object_types.indexOf(sub_definition.type) != -1) schema_part.type = ObjectId
				} else {
					recursive(schema[key] = {}, sub_definition)
				}
			}
		})

		return schema
	}

	return recursive({}, definition);
}

Form.definitionToForm = function(definition, ObjectId) {
	var form = { fields:[], refs:{}, formats:{}, reformats:{}, filters:{} }
	  , object_keys = [ 'filter', 'format', 'reformat' ]

	if(definition.fieldsets === false) {
		setUpFieldset(form, definition)
	} else {
		Object.keys(definition).forEach(function(key) {
			var sub_definition = definition[key]
			  , sub_sub_definition
			  , fieldset = {}
			if(sub_definition instanceof Object && Object.keys(sub_definition).length) {
				if(sub_definition.type) {
					sub_sub_definition = sub_definition
					sub_definition = {
						  legend: sub_sub_definition.legend
						, info: sub_sub_definition.info
					}
					sub_definition[key] = sub_sub_definition
					delete sub_sub_definition.legend
					delete sub_sub_definition.info
				}
				setUpFieldset(fieldset, sub_definition, key, !sub_sub_definition && key)
				form.fields.push(fieldset)
			}
		})
	}
	return form

	function setUpFieldset(fieldset, definition, key, path) {
		var fields = []
		Object.keys(definition).forEach(function(key) {
			var sub_definition = definition[key]
			  , field = {}
			  , current_path = path ? path+'.'+key : key
			if(sub_definition) {
				if(sub_definition.type || (sub_definition instanceof Array && sub_definition[0].type)) {
					field = { name:current_path, label:definition.label||path?Form.variableToDisplay(key):'' }
					setupField(field, key, sub_definition)
					fields.push(field)
				} else if(sub_definition instanceof Object && object_keys.indexOf(key) == -1) {
					setUpFieldset(field, sub_definition, key, current_path)
					fields.push(field)
				} else {
					fieldset[key] = sub_definition[key]
				}
			}
		})
		if(key) {
			fieldset.legend = definition.legend || Form.variableToDisplay(key)
			fieldset.class = path ? path.replace(/\./g, ' ') : key
		}
		fieldset.fields = fields
	}

	function setupField(field, key, definition) {
		var attributes = [ 'name', 'multiple', 'required' ]
		  , data_attributes = [ 'true', 'false', 'html' ]
		  , undefined

		if(definition instanceof Array) {
			field.multiple = true
			definition = definition[0]
		}

		Object.keys(definition).forEach(function(key) {
			field[key] = definition[key]
		})
		
		if(definition.type == ObjectId || definition.type == 'ref') {
			field.type = 'select'
			field.display = definition.display || 'name'
		}
		else if(definition.options) {
			field.type = 'select'
		}
		else if(definition.type == String) {
			field.type = 'input'
			field.input = 'text'
		}
		else if(definition.type == Date) {
			field.type = 'input'
			field.input = 'date'
		}
		else if(definition.type == Boolean) {
			field.type = 'input'
			field.input = 'checkbox'
		}
		else if(definition.type == Number) {
			field.type = 'input'
			field.input = 'number'
		}
		else if(definition.type == 'html') {
			field.type = 'textarea'
			field.html = true
		}
		else if(definition.type == 'textarea') {
			field.type = 'textarea'
		}
		else if(definition.type == 'image') {
			field.type = 'input'
			field.input = 'file'
			field.image = true
		}
		else if(definition.type == 'datetime') {
			field.type = 'input'
			field.input = 'datetime-local'
		}
		else if(definition.type == 'phone') {
			field.type = 'input'
			field.input = 'tel'
		}
		else {
			field.type = 'input'
			field.input = definition.type
		}

		field.attributes = []

		attributes.forEach(function(attribute) {
			if(typeof field[attribute] == 'string') 
				field.attributes.push({ key:attribute, value:field[attribute] })
			else if(typeof field[attribute] == 'boolean' && field[attribute])
				field.attributes.push({ key:attribute })
		})
		data_attributes.forEach(function(attribute) {
			if(typeof field[attribute] == 'string') 
				field.attributes.push({ key:'data-'+attribute, value:field[attribute] })
			else if(typeof field[attribute] == 'boolean' && field[attribute])
				field.attributes.push({ key:'data-'+attribute })
		})
 
		if(definition.ref) form.refs[field.name] = definition.ref
		if(definition.format) form.formats[field.name] = definition.format
		if(definition.reformat) form.reformats[field.name] = definition.reformat
		if(definition.filter) form.filters[field.name] = definition.filter
	}
}

Form.variableToDisplay = function(variable_name) {
	return variable_name.replace(/(\b[a-z]|_[a-z])/g, function(match) {
		return match.toUpperCase().replace(/_/g, ' ')
	})
}

Form.render = function(entity, check, fn) {
	if(entity instanceof Function) {
		if(check instanceof Function) {
			fn = check
			check = entity
		} else {
			fn = entity
			check = null
		}
		entity = null
	} else if(!fn && check instanceof Function) {
		fn = check
		check = null
	}

	var form = this.schema.get('form')
	  , data = { fields:form.fields, refs:{}, top_level:true }
	  , remaining = Object.keys(form.refs).length
	  , mongoose = this

	if(entity) data.entity = Form.flatten(entity._doc)

	//filter permissions
	//remove empty fieldsets

	Object.keys(form.refs).forEach(function(field) {
		mongoose.model(form.refs[field]).find(function(err, ref) {
			data.refs[field] = ref
			if(!--remaining) dust.render('form', data, fn)
		})
	})
}

Form.upload = function(file, fn) {
	if(!Form.upload_path) 
		throw new Error('An upload_path or upload function is required')

	var public_path = '/'+Date.now()+'/'
	  , absolute_path = Form.upload_path+public_path
	fs.mkdir(absolute_path, function(err) {
		if(err) return fn(err)
		fs.rename(file.path, absolute_path+file.name, function(err) {
			if(err) return fn(err)
			fn(null, public_path+file.name)
		})
	})
}

Form.populate = function(entity, check, req, fn) {
	if(entity instanceof Function) {
		fn = req
		req = check
		check = entity
		entity = null
	} else if(!(check instanceof Function)) {
		fn = req
		req = check
		check = null
	} else if(check instanceof Function && !req && !fn) {
		fn = check
		req = entity
		check = entity = null
	}

	if(!entity) entity = new this()

	var definition = this.schema.get('definition')
	  , remaining = Object.keys(req.body).length + Object.keys(req.files).length
	Object.keys(req.body).forEach(function(key) {
		var def = definition[key]
		if(def) {
			if(def.ref && !req.body[key]) {
				entity.set(key)
			} else {
				entity.set(key, req.body[key])
			}
		}
		if(!--remaining) fn(null, entity)
	})
	Object.keys(req.files).forEach(function(key) {
		var file = req.files[key]
		file.name = file.name.replace(/#/g, '')
		if(file.size) Form.upload(file, function(err, path) {
			entity.set(key, path)
			if(!--remaining) fn(null, entity)
		})
		else if(!--remaining) fn(null, entity)
	})
}

Form.handleSubmission = function(entity, req, res, next, redirect) {
	Form.populate.call(this, entity, req, function(err, entity) {
		if(err) return next(err)
		entity.save(function(err) {
			if(err) return next(err)
			res.redirect('/')
		})
	})
}

Form.flatten = function(parent, current, path) {
	if(!current) {
		current = parent
		parent = {}
	}

	Object.keys(current).forEach(function(key) {
		var current_path = path ? path+'.'+key : key
		parent[current_path] = current[key]
		if(current[key] && current[key].constructor == Object) {
			Form.flatten(parent, current[key], current_path)
		}
	})

	return parent
}