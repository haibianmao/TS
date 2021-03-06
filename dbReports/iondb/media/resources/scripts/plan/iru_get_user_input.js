/**
    NOTE:  IRU and TS terminology differs slightly.  In IRU, the column "Relation" is equivalent to TS' "RelationRole",
    and IRU's column RelationshipType is TS' "Relation" in the JSON blob that is saved to the selectedPlugins BLOB.
*/
var USERINPUT = USERINPUT || {};

USERINPUT.user_input_url = "/rundb/api/v1/plugin/IonReporterUploader/extend/userInput/";
USERINPUT.workflows = [];
USERINPUT.relations = [];
USERINPUT.genders = [];
USERINPUT.cancerTypes = [];
USERINPUT.relations_with_gender = {};

var SEPARATOR = " | ";
var ION_PRELOADED_LABEL = "Ion Torrent";


function getIonReporterFields(){
    if (!USERINPUT.account_id || USERINPUT.account_id == "0" || USERINPUT.account_id == "-1"){
        return [];
    }
    
    var iru_fields = {
        // Oncology
        ircancerType:   { type: "string", defaultValue: "",
            editable:function(){return USERINPUT.is_ir_connected}
        },
        ircellularityPct: { type: "number" },
        // PGx
        irbiopsyDays:   { type: "number" },
        ircoupleID:     { type: "string", defaultValue: ""},
        irembryoID:     { type: "string", defaultValue: ""},
            // IR Workflow
        irWorkflow:     { type: "string", defaultValue: USERINPUT.workflow,
            editable:function(){return USERINPUT.is_ir_connected}
        },
        irtag_isFactoryProvidedWorkflow: { type: "bool", defaultValue: USERINPUT.tag_isFactoryProvidedWorkflow },
        irRelationRole: { type: "string",
            defaultValue: function getdefaultrelation(){ return defaultRelation(USERINPUT.workflow, USERINPUT.tag_isFactoryProvidedWorkflow)},
            isValueRequired: true,
            editable: function(){return USERINPUT.is_ir_connected}
        },
        irGender:       { type: "string", defaultValue: "",
            editable: function(){return USERINPUT.is_ir_connected}
        },
        irSetID:        { type: "number" }
    }
    return iru_fields;
}


function getIonReporterColumns(){
    if (!USERINPUT.account_id || USERINPUT.account_id == "0" || USERINPUT.account_id == "-1"){
        return [];
    }

    var iru_columns = [
        // Oncology
        {
            field: "ircancerType", title: "Cancer Type",
            width: '150px',
            attributes: { "name": "ircancerType" },
            hidden: !$('#isOnco').is(':checked'),
            editor: irCancerTypeEditor,
            template: dropDnTemplate({'html': '#=ircancerType#'})
        },
        {
            field: "ircellularityPct", title: "Cellularity %",
            width: '150px',
            attributes: { "name": "ircellularityPct", "class": "integer" },
            hidden: !$('#isOnco').is(':checked'),
            editor: ircellularityPctEditor,
        },
        // PGx
        {
            field: "irbiopsyDays", title: "Biopsy Days",
            width: '100px',
            attributes: { "name": "irbiopsyDays", "class": "integer" },
            hidden: !$('#isPgs').is(':checked')
        },
        {
            field: "ircoupleID", title: "Couple ID",
            width: '100px',
            attributes: { "name": "ircoupleID" },
            hidden: !$('#isPgs').is(':checked')
        },
        {
            field: "irembryoID", title: "Embryo ID",
            width: '100px',
            attributes: { "name": "irembryoID" },
            hidden: !$('#isPgs').is(':checked')
        },
        // IR Workflow
        {
            field: "irWorkflow", title: "Ion Reporter Workflow",
            width: '350px',
            attributes: { "name": "irWorkflow" },
            editor: irWorkflowEditor,
            template: dropDnTemplate({'html': $('#irWorkflowColumnTemplate').html()})
        },
        {
            field: "irRelationRole", title: "Relation",
            width: '100px',
            attributes: { "name": "irRelationRole" },
            editor: irRelationEditor,
            template: dropDnTemplate({'html': '#=irRelationRole#'})
        },
        {
            field: "irGender", title: "Gender",
            width: '100px',
            attributes: { "name": "irGender" },
            editor: irGenderEditor,
            template: dropDnTemplate({'html': '#=irGender#'})
        },
        {
            field: "irSetID", title: "IR Set ID",
            width: '60px',
            attributes: { "name": "irSetID" },
            headerAttributes: { "rel": "tooltip", "data-original-title": "After file transfer, in Ion Reporter Software, samples with the same Set ID are considered related samples and are launched in the same analysis, such as a normal sample and its corresponding tumor samples. Do not give unrelated samples the same Set ID value (even if that value is zero or blank)."},
            headerTemplate: '<i class="icon-info-sign"></i> IR Set ID'
        }
    ];
    return iru_columns;
}

function getWorkflowObj(workflow, tag_isFactoryProvidedWorkflow){
    if (!workflow || workflow == "Upload Only") workflow = "";
    var match = $.grep(USERINPUT.workflows, function(obj){ return obj.Workflow == workflow && obj.tag_isFactoryProvidedWorkflow == tag_isFactoryProvidedWorkflow });
    if (match.length == 0){
        match = $.grep(USERINPUT.workflows, function(obj){ return obj.Workflow == workflow });
    }
    //console.log('getWorkflowObj', workflow, tag_isFactoryProvidedWorkflow, match);
    return (match.length > 0) ? match[0] : null;
}

function irWorkflowEditor(container, options) {
    $('<input id="irWorkflowEditor" name="irWorkflowEditor" data-bind="value:' + options.field + '"/>')
        .appendTo(container)
        .kendoDropDownList({
            dataSource: USERINPUT.workflows,
            dataTextField: "display",
            dataValueField: "Workflow",
            open: function(e){
                var reference = options.model.get('reference');
                if (reference){
                    e.sender.dataSource.filter({
                        logic: "or",
                        filters: [
                            { field: "Reference", value: reference },
                            { field: "Reference", value: "" },
                        ]
                    });
                }
                // save next grid row to update for RNA/DNA plans
                this.nextGridItem = $("#grid").data("kendoGrid").dataItem(this.element.closest("tr").next());
            },
            change: function(e){
                var workflowObj = this.dataItem();
                var relation = workflowObj.relations_list.length == 1 ? workflowObj.relations_list[0] : "";

                options.model.set('irtag_isFactoryProvidedWorkflow', workflowObj.tag_isFactoryProvidedWorkflow);
                options.model.set('irRelationRole', relation);
                if (hasGender(relation)) options.model.set('irGender', '');

                // fill in irSetID value
                var data = $("#grid").data("kendoGrid").dataSource.data().toJSON();
                data.splice(options.model.row, 1); // get rows other than this one
                var setid = set_id_from_workflow(workflowObj, options.model.irSetID, data);
                options.model.set('irSetID', setid);

                // update fields for RNA row if same sample for dual nuc type
                var nextGridItem = this.nextGridItem;
                var isSameSampleForDual = $('input[id=isOncoSameSample]').is(":checked");
                if (planOpt.isDualNucleotideType && isSameSampleForDual && nextGridItem){
                    nextGridItem.set('irRelationRole', relation);
                    if (hasGender(relation)) nextGridItem.set('irGender', '');
                            nextGridItem.set('irSetID', setid);
                }

                // change IR validation errors to warnings
                updateIRvalidationErrors(options.model.row, ['irWorkflow', 'irRelationRole', 'irGender', 'irSetID']);
            },
        });
}

function irRelationEditor(container, options) {
    $('<input id="irRelationEditor" name="irRelationEditor" data-bind="value:' + options.field + '"/>')
        .appendTo(container)
        .kendoDropDownList({
            dataSource: USERINPUT.relations,
            dataTextField: "display",
            dataValueField: "Relation",
            optionLabel: "---",
            open: function(e) {
                var workflowObj = getWorkflowObj(options.model.irWorkflow, options.model.irtag_isFactoryProvidedWorkflow);
                var irRelationshipType = workflowObj ? workflowObj.RelationshipType : "";
                e.sender.dataSource.filter({
                    field: "RelationshipType", operator: "contains", value: irRelationshipType
                });
            },
            change: function(e){
                if (hasGender(options.model.irRelationRole)){
                    options.model.set('irGender', '');
                }
                updateIRvalidationErrors(options.model.row, ['irRelationRole', 'irGender']);
            }
        });
}

function irGenderEditor(container, options) {
    $('<input id="irGenderEditor" name="irGenderEditor" data-bind="value:' + options.field + '"/>')
        .appendTo(container)
        .kendoDropDownList({
            dataSource: USERINPUT.genders,
            dataTextField: "display",
            dataValueField: "Gender",
            optionLabel: "---",
            open: function(e) {
                if (hasGender(options.model.irRelationRole)){
                    e.sender.dataSource.filter({
                        field: "Relation", operator: "contains", value: options.model.irRelationRole
                    });
                }
            },
            change: function(e){
                updateIRvalidationErrors(options.model.row, ['irGender']);
            }
        });
}

function irCancerTypeEditor(container, options) {
    $('<input id="irCancerTypeEditor" name="irCancerTypeEditor" data-bind="value:' + options.field + '"/>')
        .appendTo(container)
        .kendoDropDownList({
            dataSource: USERINPUT.cancerTypes,
            dataTextField: "display",
            dataValueField: "CancerType",
            optionLabel: "---",
            change: function(e){
                updateIRvalidationErrors(options.model.row, ['ircancerType']);
            }
        });
}

function ircellularityPctEditor(container, options) {
    $('<input id="ircellularityPctEditor" name="ircellularityPctEditor" data-bind="value:' + options.field + '"/>')
        .appendTo(container)
        .kendoNumericTextBox({ min: 0, max: 100, step: 1 });
}

function hasGender(Relation){
    return (Relation in USERINPUT.relations_with_gender)
}

function defaultRelation(workflow, tag_isFactoryProvidedWorkflow){
    var workflowObj=getWorkflowObj(workflow, tag_isFactoryProvidedWorkflow)
    if (workflowObj && workflowObj.relations_list.length == 1){
        return workflowObj.relations_list[0];
    }
    return "";
}

function irWorkflowNotValid(reference, workflow, tag_isFactoryProvidedWorkflow){
    if (USERINPUT.is_ir_connected){
        var workflowObj = getWorkflowObj(workflow, tag_isFactoryProvidedWorkflow);
        if (reference && workflowObj && workflowObj.Reference){
            return reference != workflowObj.Reference;
        }
    }
    return false;
}

/**
    Attempt to auto populate SetID, if simple logic is not enough then display the column for user input
*/
function set_id_from_workflow(workflowObj, old_setid, other_rows){
    // data = $("#grid").data("kendoGrid").dataSource.data().toJSON();
    var setid = parseInt(old_setid) || '';
    var relations_list_length = workflowObj.relations_list.length;
    var other_rows_w_same_workflow = other_rows.filter(function(obj){ return obj.irWorkflow == workflowObj.Workflow });
    
    if ( (relations_list_length > 1) && (other_rows_w_same_workflow.length > 0) ){
        // assign existing set id if available, otherwise show column for user input
        if(other_rows_w_same_workflow.length < relations_list_length){
            setid = other_rows_w_same_workflow[0]['irSetID'];
        } else {
            setid = '';
            console.log('unable to autofill IR SetID for', workflowObj.Workflow);
        }
    }else{
        var other_setids = other_rows.map(function(obj){ return obj.irSetID});
        if (!setid || ( $.inArray(setid, other_setids) >= 0) ){
            // assign unique set id for this workflow
            setid = Math.max.apply(Math, other_setids) + 1;
        }
    }
    return setid;
}

function updateIRvalidationErrors(row, fields){
    // change any IR validation errors to warnings when table values are updated
    var needs_refresh = false;
    $.each(samplesTableValidationErrors, function(i, error){
        if (error.row == row && fields.indexOf(error.field) > -1){
            error.type = 'warning';
            needs_refresh = true;
        }
    });
    if (needs_refresh) setTimeout(function(){ gridRefresh($('#grid').data('kendoGrid'))}, 200);
}

/**
    This function searches the API returned result for a relationship type 
    for a given workflow
*/
function find_relationship_type(workflow, columns_map) {
    var relationshipType = "";
    $.each(columns_map, function(i){
        var column = columns_map[i];
        if (column["Workflow"] == workflow) {
            relationshipType = column["RelationshipType"];
        }
    });
    return relationshipType;
}

/**
* Filter IR workflows based on runType and application group
*/
function get_workflow_url() {
    var applicationGroupName = $('input[name=applicationGroupName]').val();
    var runType_name = $('input[name=runType_name]').val();
    var runType_nucleotideType = $('input[name=runType_nucleotideType]').val();

    var planCategories = $('input[name=planCategories]').val();
    console.log("iru_get_user_input.get_workflow_url() applicationGroupName=", applicationGroupName, "; runType_name=", runType_name, "; runType_nucleotideType=", runType_nucleotideType, "; planCategories=", planCategories);
  
    var myURL = USERINPUT.user_input_url;

    myURL += "?format=json&id=" + USERINPUT.account_id;
    var isFilterSet = false;

    if (runType_nucleotideType.toLowerCase() == "dna" || (runType_nucleotideType == "" && applicationGroupName.toLowerCase() == "dna")) {
        myURL += "&filterKey=DNA_RNA_Workflow&filterValue=";
        myURL += "DNA";
        
        isFilterSet = true;
    }
    else if (runType_nucleotideType.toLowerCase() == "rna" || (runType_nucleotideType == "" && applicationGroupName.toLowerCase() == "rna")) {
        myURL += "&filterKey=DNA_RNA_Workflow&filterValue=";
        myURL += "RNA";
        
        isFilterSet = true;
    }

    if (applicationGroupName == "DNA + RNA") {
        /*for mixed single & paired type support    
        if (runType_nucleotideType.toLowerCase() == "dna_rna") {
            myURL += "&filterKey=DNA_RNA_Workflow&filterValue=";
            myURL += "DNA_RNA";
            isFilterSet = true;
        }
        */
        //myURL += "&andFilterKey2=OCP_Workflow&andFilterValue2=true";

        if (planCategories.toLowerCase().indexOf("oncomine") != -1) {            
//            if (!isFilterSet) {
//                myURL += "&filterKey=Onconet_Workflow&filterValue=false";  
//            }
            myURL += "&andFilterKey2=OCP_Workflow&andFilterValue2=true";     
        }
        else if (planCategories.toLowerCase().indexOf("onconet") != -1) {
            if (!isFilterSet) {
                myURL += "&filterKey=Onconet_Workflow&filterValue=true";
            }
            else {
                myURL += "&andFilterKey2=Onconet_Workflow&andFilterValue2=true";
            }
        }
    }
    else {
        if (runType_name.toLowerCase() != "amps") {
            if (!isFilterSet) {
                myURL += "&filterKey=Onconet_Workflow&filterValue=false";
            }
			if (applicationGroupName == "onco_liquidBiopsy") {
				myURL += "&andFilterKey2=OCP_Workflow&andFilterValue2=true";
			}
			else {
            	myURL += "&andFilterKey2=OCP_Workflow&andFilterValue2=false";
            }
        }
        else {
            if (planCategories.toLowerCase().indexOf("oncomine") != -1) {
                myURL += "&andFilterKey2=OCP_Workflow&andFilterValue2=true";
            }
            else if (planCategories.toLowerCase().indexOf("onconet") != -1) {
                myURL += "&andFilterKey2=Onconet_Workflow&andFilterValue2=true";
            }          
        }
    }
    return myURL;
}

/**
* Validate selected values are compatible with data returned by IRU
*/
function check_selected_values(){
    var errors = [];
    var samplesTableJSON = $("#grid").data("kendoGrid").dataSource.data().toJSON();
    var isSameSampleForDual = $('input[id=isOncoSameSample]').is(":checked");

    $.each(samplesTableJSON, function(i,row){
        if( row.irWorkflow && ($.grep(USERINPUT.workflows, function(obj){ return obj.Workflow == row.irWorkflow } ).length == 0) ){
            errors.push("<br>Row "+ (row.row+1) + ": Previous workflow for this plan is no longer available: " + row.irWorkflow)
            row.irWorkflow = "";
            row.irRelationRole = "Self";
        }
        if (row.irRelationRole && ($.grep(USERINPUT.relations, function(obj){ return obj.Relation == row.irRelationRole } ).length == 0) ){
            errors.push("<br>Row "+ (row.row+1) + ": Selected Relation not found: " + row.irRelationRole);
            row.irRelationRole = "";
        }
        if (row.irGender && ($.grep(USERINPUT.genders, function(obj){ return obj.Gender == row.irGender } ).length == 0) ){
            errors.push("<br>Row "+ (row.row+1) + ": Selected Gender not found: " + row.irGender);
            row.irGender = "";
        }
        if (row.ircancerType && ($.grep(USERINPUT.cancerTypes, function(obj){ return obj.CancerType == row.ircancerType } ).length == 0) ){
            errors.push("<br>Row "+ (row.row+1) + ": Selected Cancer Type not found: " + row.ircancerType);
            row.ircancerType = "";
        }
        if (!row.irSetID){
            if( i > 0 && row.irWorkflow) {
                if (planOpt.isDualNucleotideType && isSameSampleForDual && !isEven(i)){
                    row.irSetID = samplesTableJSON[i-1].irSetID;
                } else {
                    var workflowObj=getWorkflowObj(row.irWorkflow, row.tag_isFactoryProvidedWorkflow)
                    row.irSetID = set_id_from_workflow(workflowObj, 1, samplesTableJSON.slice(0, i));
                }
            } else {
                row.irSetID = 1;
            }
        }
    });

    // update via local data to run dataSource initialization
    samplesTableInit = samplesTableJSON;
    $("#grid").data("kendoGrid").dataSource.read();

    $("#error").html(errors.toString());
    if (errors.length > 0) $('html, body').animate({scrollTop : $('#error').prop("scrollHeight")},500);
}


/**
    Parse data returned from IRU and save in USERINPUT
**/
function populate_userinput_from_response(data){
    var columns = data["sampleRelationshipsTableInfo"]["columns"];
    var column_map = data["sampleRelationshipsTableInfo"]["column-map"];
    var restrictions = data["sampleRelationshipsTableInfo"]["restrictionRules"];
    
    //sorts the columns by the Order key
    columns.sort(function(columnA, columnB){
        return columnA.Order - columnB.Order;
    });

    // parse restriction rules
    var relation_to_relationshipType = {};
    var gender_to_relation = {};
    var relationshipType_to_relations = {};
    $.each(restrictions, function(i, restriction){
        if (typeof restriction["For"] != 'undefined') {
            if (restriction["For"]["Name"] == 'RelationshipType') {
                $.each(restriction["Valid"]["Values"], function(i, value){
                    relation_to_relationshipType[value] = relation_to_relationshipType[value] || [];
                    relation_to_relationshipType[value].push(restriction["For"]["Value"]);
                });
                
                relationshipType_to_relations[restriction["For"]["Value"]] = restriction["Valid"]["Values"];
            }
            else if (restriction["For"]["Name"] == 'Relation') {
                $.each(restriction["Valid"]["Values"], function(i, value){
                    gender_to_relation[value] = gender_to_relation[value] || [];
                    gender_to_relation[value].push(restriction["For"]["Value"]);
                });
                // also save which relations have associated Gender
                USERINPUT.relations_with_gender[restriction["For"]["Value"]] = restriction["Valid"]["Values"];
            }
        }
    });

    // Workflow
    $.each(column_map, function(i, cm){
        var workflow = cm["Workflow"];
        var irReference = cm["irReference"] || "";
        // reference name conversion: TS "GRCh38.p2.mask1" = IR "GRCh38"
        var reference = (irReference == "GRCh38") ? "GRCh38.p2.mask1" : irReference
        var relationshipType = cm["RelationshipType"];

        USERINPUT.workflows.push({
            "Workflow": workflow != "Upload Only" ? workflow : "",
            "display": get_decorated_workflow_name(cm, workflow, irReference, ION_PRELOADED_LABEL, SEPARATOR),
            "tag_isFactoryProvidedWorkflow": cm["tag_isFactoryProvidedWorkflow"],
            "ApplicationType": cm["ApplicationType"],
            "RelationshipType": relationshipType,
            "Reference": reference,
            "relations_list": relationshipType_to_relations[relationshipType] || []
        });
    });

    // Relation and Gender
    $.each(columns, function(i, column){
        if (column["Name"] == "Relation"){
            USERINPUT.relations = $.map(column["Values"], function(value, key){
                var relationshipType = relation_to_relationshipType[value] || [];
                return {
                    "Relation": value,
                    "display": value,
                    "RelationshipType": relationshipType.toString()
                };
            });
        }
        if (column["Name"] == "Gender"){
            USERINPUT.genders = $.map(column["Values"], function(value, key){
                var relation =  gender_to_relation[value] || [];
                return {
                    "Gender": value,
                    "display": value,
                    "Relation": relation.toString()
                };
            });
        }
        if (column["Name"] == "CancerType"){
            USERINPUT.cancerTypes = $.map(column["Values"], function(value, key){
                return {
                    "CancerType": value,
                    "display": value
                };
            });
        }
    });
}

/**
    Main function to call IRU and process the response
**/
function load_and_set_ir_fields() {
    var myURL = get_workflow_url();

    $.blockUI();
    var jqhxhr = $.ajax({
        type : "get",
        url : myURL,
        timeout: 6000,//in milliseconds
        success: function(data){
            if (typeof data["sampleRelationshipsTableInfo"] == 'undefined') {
                // failed to retrieve info
                $("#loading").hide();
                USERINPUT.is_ir_connected = false;
                $("#error").text("Cannot contact Ion Reporter Server!");
                $("input[name=irDown]").val('1');
                return;
            }
            else {
                USERINPUT.is_ir_connected = true;
            }
            $("#error").text("");
            $("input[name=irDown]").val('0');

            // parse data and fill in USERINPUT fields
            populate_userinput_from_response(data);
            
            // set application type hidden input from selected workflow
            var default_workflow = getWorkflowObj(USERINPUT.workflow, USERINPUT.tag_isFactoryProvidedWorkflow);
            if (default_workflow)
                $("input[name=applicationType]").val(default_workflow.ApplicationType);

            // make sure existing selections are valid
            check_selected_values();

            hide_summary_view();
            $("#loading").hide();
        },
        error: function(jqXHR, textStatus, errorThrown){
            if(textStatus==="timeout") {
                //The API Server timedout
                $("#loading").hide();
                $("#error").text('The IR Server connection has timed out');
                $("input[name=irDown]").val('1');
                return;
            }
            else {
                console.log("iru_get_user_input - textStatus=", textStatus);
            }
        }
    });
}

$(document).ready(function(){
    //handler for asynchroneous Ajax calls to block and unblock the UI
    $(document).ajaxStop($.unblockUI);

    if (USERINPUT.account_id != "0" && USERINPUT.account_id != "-1"){
        load_and_set_ir_fields();
    }
});
