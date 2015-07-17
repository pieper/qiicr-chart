import xmltodict, os, sys, xml.dom.minidom
from xml.etree import ElementTree as ET
import dicom
from lxml import etree
import lxml

def getPatientID(dom):
  elements = dom.getElementsByTagName('patient')
  print str(elements),len(elements)
  for c in elements[0].childNodes:
    print c,c.nodeValue,c.getText
    #print e.getElementsByTagName('id')[0].nodeValue

def getNodeValueByConceptMeaning(root, meaning):
  #print etree.tostring(node)
  node = root.xpath('.//meaning[text()=\"'+meaning+'\"]')[0].getparent().getparent()
  #print etree.tostring(node)
  return node.xpath('./value')[0].text

def getNodeMeaningByConceptMeaning(root, meaning):
  #print etree.tostring(node)
  node = root.xpath('.//meaning[text()=\"'+meaning+'\"]')[0].getparent().getparent()
  return node.xpath('./meaning')[0].text

'''
Input: file prefix, DICOM SR and XML are expected at <prefix>.dcm and <prefix>.xml

Output: JSON of items of interest from SR XML

Preprocessing in bash:

  get XML representation for all tumor SRs:

    for f in `find . |grep DICOM|grep '\/SR\/'|grep tumor|grep dcm`; do dsr2xml $f > ${f%.*}.xml;done

  get items of interest for all tumor SRs:

    for f in `find . |grep DICOM|grep '\/SR\/' |grep xml`;do python ~/github/JSSRparser/munch.py ${f%.*};done | tee measurements_summary.json
'''

root = etree.fromstring(open(sys.argv[1]+'.xml','r').read())
dcm = dicom.read_file(sys.argv[1]+'.dcm')

data = {}

# what a pity - not directly in SR, only in ref'd SEG! ... hack :(
if dcm.SeriesDescription.find("SemiAuto")>=0:
  data['AlgorithmType'] = "SemiAuto"
else:
  data['AlgorithmType'] = "Manual"

data['PatientID'] = root.find('.//patient/id').text

# find measurement group for the primary tumor
ptElement = root.xpath('.//value[text()="M-80003"]')
try:
  measurementGroup = ptElement[0].getparent().getparent()
except:
  #print 'Failed to find Primary tumor in',sys.argv[1]
  sys.exit()

data['PersonObserverName'] = root.xpath('./document/content/container/pname/value/last')[0].text
data['ObserverType'] = getNodeMeaningByConceptMeaning(root,"Observer Type")
data['TimePoint'] = getNodeValueByConceptMeaning(measurementGroup,"Time Point")

# measurements
itemsOfInterest = ['Activity Session', 'Volume', 'Minimum', 'Maximum', 'Mean', 'Peak Value Within ROI']

for i in itemsOfInterest:
  try:
    data[i] = getNodeValueByConceptMeaning(measurementGroup, i)
  except:
    continue
    #print 'Failed to find',i,'in',sys.argv[1]

# print data
output = "{"
for k in data.keys():
  output = output + str(k.replace(' ',''))+':'
  if k in itemsOfInterest or k == "TimePoint":
    output = output + str(data[k])
  else:
    output = output + '\''+str(data[k])+'\''

  output += ','

output = output[:-1]+"},"
print output
