var sinon = require('sinon')
  , should = require('should')
  , mongoose = require('mongoose')
  , proxyquire = require('proxyquire')
  , ObjectId = mongoose.SchemaTypes.ObjectId
  , mongoose_stub = { SchemaTypes:mongoose.SchemaTypes }
  , form = proxyquire('./index', { 'mongoose':mongoose_stub })
  , dummy_form
  , dummy_definition
  , dummy_schema

dummy_definition = {
	  name: {
	  	  first: { type:'text' }
	  	, last: { type:'text' }
	  }
	, employment: {
		  legend: 'Employment Data'
		, community: { type:'ref', ref:'Community', required:true }
		, jobposition: { type:'ref', ref:'JobPosition', label:'Job Position' }
	}
	, email: { type:'email' }
}

dummy_schema = {
	  name: {
	  	  first: { type:String }
	  	, last: { type:String }
	  }
	, employment: {
		  community: { type:ObjectId, ref:'Community', required:true }
		, jobposition: { type:ObjectId, ref:'JobPosition' }
	}
	, email: { type:String }
}

dummy_form = {
	  fields:[{
	  	  legend:"Name"
	  	, class:"name"
	  	, fields:[
	  	  	  { label:'First', name:"name.first", type:"input", input:"text" }
	  	  	, { label:'Last', name:"name.last", type:"input", input:"text" }
	  	  ]
	  },{
	  	  legend:"Employment Data"
	  	, class:"employment"
	  	, fields:[
	  	  	  { label:'Community', name:"employment.community", type:"select", ref:"Community", display:"name", required:true }
	  	  	, { label:'Job Position', name:"employment.jobposition", type:"select", ref:"JobPosition", display:"name" }
	  	  ]
	  },{
	  	  legend:"Email"
	  	, class:"email"
	  	, fields:[
	  	  	  { label:"Email", name:"email", type:"input", input:"email" }
	  	  ]
	  }]
	, refs: {
	  	  'employment.community':'Community'
	  	, 'employment.jobposition':'JobPosition'
	  }
	, formats: {}
	, filters: {}
}

mongoose_stub.model = function(model_name) {
	return {
		find: function(fn) {
			process.nextTick(function() {
				fn(null, [ { _id:'1', name:'First '+model_name}, { _id:'2', name:'Second '+model_name} ])
			})
		}
	}
}

describe('form', function() {
	describe('definitionToSchema', function() {
		it('should throw an error if no definition is passed', function() {
			(function() {
				form.definitionToSchema()
			}).should.throw(/definition/)
		})
		it('should remove non-mongoose fields', function() {
			var schema = form.definitionToSchema({ name:{ type:String, required:true, label:'Full Name' }})
			schema.name.type.should.equal(String)
			schema.name.required.should.be.true
			should.not.exist(schema.name.label)
		})
		it('should set type to String when the type is a form-specific string type', function() {
			var schema = form.definitionToSchema({ name:{ type:'image', label:'Full Name' }})
			schema.name.type.should.equal(String)
			should.not.exist(schema.name.label)
		})
		it('should set type to ObjectId when the type is a form-specific objectId type', function() {
			var schema = form.definitionToSchema({ name:{ type:'ref', label:'Full Name' }})
			schema.name.type.should.equal(ObjectId)
			should.not.exist(schema.name.label)
		})
		it('should work for nested definition objects', function() {
			var schema = form.definitionToSchema({ name:{ first:{ type:String, required:true, label:'First Name'} } })
			schema.name.first.type.should.equal(String)
			schema.name.first.required.should.be.true
			should.not.exist(schema.name.first.label)
		})
		it('should work for arrays', function() {
			var schema = form.definitionToSchema({ names:[{ type:'text' }] })
			schema.names.length.should.equal(1)
			schema.names[0].type.should.equal(String)
		})
		it('should work for a more complex definition', function() {
			var actual_schema = form.definitionToSchema(dummy_definition)
			should.deepEqual(actual_schema, dummy_schema)
		})
	})
	describe('variableToDisplay', function() {
		it('should capitalize underscore separated words', function() {
			form.variableToDisplay('my_name').should.equal('My Name')
		})
	})
	describe('definitionToForm', function() {
		it('should return an array of fieldsets', function() {
			var form_data = form.definitionToForm({})
			form_data.fields.should.be.an.instanceOf(Array)
		})
		it('should create a fieldset object for each top-level field', function() {
			var form_data = form.definitionToForm({ name:{ type:'text' } })
			form_data.fields.length.should.equal(1)
			should.exist(form_data.fields[0].legend)
			form_data.fields[0].fields.length.should.equal(1)
		})
		it('should not create a fieldset object for each top-level field if fieldsets is false', function() {
			var form_data = form.definitionToForm({ name:{ type:'text' }, fieldsets:false })
			should.not.exist(form_data.fields[0].legend)
			should.not.exist(form_data.fields[0].fields)
		})
		it('should set a legend and class for each fieldset', function() {
			var form_data = form.definitionToForm({ name:{ type:'text' } })
			form_data.fields[0].legend.should.equal('Name')
			form_data.fields[0].class.should.equal('name')
			form_data = form.definitionToForm({ name:{ type:'text', legend:'Full Name' } })
			form_data.fields[0].legend.should.equal('Full Name')
			form_data.fields[0].class.should.equal('name')
		})
		it('should create a field for a top-level field if it has no nested fields', function() {
			var form_data = form.definitionToForm({ name:{ type:'text' } })
			form_data.fields[0].fields.length.should.equal(1)
			form_data.fields[0].fields[0].name.should.equal('name')
		})
		it('should create fields for each field nested under a fieldset', function() {
			var form_data = form.definitionToForm({ name:{ first:{ type:'text' }, last:{ type:'text' } } })
			form_data.fields[0].fields.length.should.equal(2)
			form_data.fields[0].fields[0].name.should.equal('name.first')
			form_data.fields[0].fields[1].name.should.equal('name.last')
		})
		it('should create deeply nested fields and fieldsets', function() {	
			var form_data = form.definitionToForm({ address:{ street: { number:{ type:Number }, name:{ type:'text' } } } })
			form_data.fields[0].fields.length.should.equal(1)
			form_data.fields[0].fields[0].fields.length.should.equal(2)
			form_data.fields[0].fields[0].fields[0].name.should.equal('address.street.number')
			form_data.fields[0].fields[0].fields[1].name.should.equal('address.street.name')
		})
		it('should create multiple types of fields', function() {
			var form_data = form.definitionToForm({ email:{ type:'email' } })
			form_data.fields[0].fields[0].type.should.equal('input')
			form_data.fields[0].fields[0].input.should.equal('email')
			
			form_data = form.definitionToForm({ cell:{ type:'phone' } })
			form_data.fields[0].fields[0].type.should.equal('input')
			form_data.fields[0].fields[0].input.should.equal('tel')

			form_data = form.definitionToForm({ is_awesome:{ type:Boolean } })
			form_data.fields[0].fields[0].type.should.equal('input')
			form_data.fields[0].fields[0].input.should.equal('checkbox')

			form_data = form.definitionToForm({ birthday:{ type:Date } })
			form_data.fields[0].fields[0].type.should.equal('input')
			form_data.fields[0].fields[0].input.should.equal('date')

			form_data = form.definitionToForm({ photo:{ type:'image' } })
			form_data.fields[0].fields[0].type.should.equal('input')
			form_data.fields[0].fields[0].input.should.equal('file')

			form_data = form.definitionToForm({ description:{ type:'html' } })
			form_data.fields[0].fields[0].type.should.equal('textarea')
		})
		it('should attach advanced stuff to the form')
		it('should work for a more complex definition', function() {
			var actual_form = form.definitionToForm(dummy_definition)
			should.deepEqual(actual_form, dummy_form)
		})
	})
	describe('render', function() {
		var model = { schema:{ get:sinon.stub().returns(dummy_form) } }
		it('should return html', function(done) {	
			form.render.call(model, {}, {}, function(err, html) {
				should.not.exist(err)
				html.indexOf('<fieldset').should.not.equal(-1)
				done()
			})
		})
	})
	describe('flatten', function() {
		it('should not modify the original object', function() {
			var obj = {}
			form.flatten(obj).should.not.equal(obj)
		})
		it('should retain top level objects', function() {
			var obj = { test1: { hi:1 }, test2:true }
			  , flat = form.flatten(obj)
			flat.test1.should.equal(obj.test1)
			flat.test2.should.equal(obj.test2)
		})
		it('should flatten nested objects', function() {
			var obj = { test1: { hi:1 } }
			  , flat = form.flatten(obj)
			flat['test1.hi'].should.equal(obj.test1.hi)
		})
	})
})